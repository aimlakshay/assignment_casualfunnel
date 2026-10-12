import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { FlameIcon, PointerIcon, RefreshIcon, UsersIcon } from './Icons.jsx';

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const DOT_RADIUS = 8;
const HEAT_RADIUS = 28;

const HEAT_STOPS = [
  [0.0, 'rgba(37, 99, 235, 0)'],
  [0.25, '#2563eb'],
  [0.45, '#06b6d4'],
  [0.65, '#84cc16'],
  [0.82, '#facc15'],
  [1.0, '#ef4444'],
];

// Most frequent value in a list (used to pick the reference viewport width).
function mode(values) {
  const counts = new Map();
  let best = null;
  let bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) || 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

// Width of the element, kept up to date on resize.
function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

// 256-entry RGBA lookup table for the heat colors.
let heatPalette;
function getHeatPalette() {
  if (heatPalette) return heatPalette;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  for (const [stop, color] of HEAT_STOPS) grad.addColorStop(stop, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  heatPalette = ctx.getImageData(0, 0, 256, 1).data;
  return heatPalette;
}

function drawDots(ctx, points) {
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();
  }
}

// Classic heatmap: accumulate soft circles as alpha, then map alpha to colors.
function drawHeat(ctx, points, width, height) {
  if (points.length === 0) return;

  for (const p of points) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, HEAT_RADIUS);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - HEAT_RADIUS, p.y - HEAT_RADIUS, HEAT_RADIUS * 2, HEAT_RADIUS * 2);
  }

  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;

  let maxAlpha = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > maxAlpha) maxAlpha = px[i];
  if (maxAlpha === 0) return;

  const palette = getHeatPalette();
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (!a) continue;
    const level = Math.min(255, Math.round((a / maxAlpha) * 255));
    px[i] = palette[level * 4];
    px[i + 1] = palette[level * 4 + 1];
    px[i + 2] = palette[level * 4 + 2];
    px[i + 3] = Math.min(230, 60 + level);
  }
  ctx.putImageData(image, 0, 0);
}

export default function HeatmapView({ initialPage = '' }) {
  const [pages, setPages] = useState([]);
  const [pagesError, setPagesError] = useState('');
  const [pageUrl, setPageUrl] = useState(initialPage);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPage, setShowPage] = useState(true);
  const [style, setStyle] = useState('heat');

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(0);
  const containerWidth = useWidth(containerRef);

  const loadPages = () => {
    setPagesError('');
    api
      .pages()
      .then((list) => {
        setPages(list);
        setPageUrl((current) => current || (list[0] && list[0].page_url) || '');
      })
      .catch((e) => setPagesError(e.message));
  };

  useEffect(loadPages, []);

  const loadHeatmap = (url) => {
    if (!url) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');
    api
      .heatmap(url)
      .then((d) => requestId === requestRef.current && setData(d))
      .catch((e) => requestId === requestRef.current && setError(e.message))
      .finally(() => requestId === requestRef.current && setLoading(false));
  };

  useEffect(() => loadHeatmap(pageUrl), [pageUrl]);

  // Clicks are plotted in a reference coordinate space: the most common viewport
  // width among the clicks. Clicks made at other widths are scaled horizontally.
  const layout = useMemo(() => {
    const clicks = (data && data.clicks) || [];
    const refWidth = mode(clicks.map((c) => c.viewport_width).filter(Boolean)) || DEFAULT_WIDTH;

    const points = clicks.map((c) => ({
      x: c.x * (c.viewport_width ? refWidth / c.viewport_width : 1),
      y: c.y,
    }));

    const refHeight = Math.max(
      DEFAULT_HEIGHT,
      ...clicks.map((c) => c.page_height || 0),
      ...points.map((p) => p.y + HEAT_RADIUS)
    );

    return {
      refWidth,
      refHeight,
      points,
      sessions: new Set(clicks.map((c) => c.session_id)).size,
    };
  }, [data]);

  const scale = containerWidth ? Math.min(1, containerWidth / layout.refWidth) : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (style === 'heat') drawHeat(ctx, layout.points, canvas.width, canvas.height);
    else drawDots(ctx, layout.points);
  }, [layout, style]);

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head wrap">
          <div>
            <h2>Click heatmap</h2>
            <p className="card-sub">Where visitors click on a page</p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              loadPages();
              loadHeatmap(pageUrl);
            }}
          >
            <RefreshIcon className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="toolbar">
          <label className="field grow">
            <span className="field-label">Page URL</span>
            <select value={pageUrl} onChange={(e) => setPageUrl(e.target.value)}>
              {pages.length === 0 && <option value="">No pages tracked yet</option>}
              {pages.map((p) => (
                <option key={p.page_url} value={p.page_url}>
                  {p.page_url} — {p.clicks} clicks
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span className="field-label">Display</span>
            <div className="segmented small" role="group" aria-label="Display style">
              <button
                type="button"
                className={style === 'heat' ? 'seg active' : 'seg'}
                aria-pressed={style === 'heat'}
                onClick={() => setStyle('heat')}
              >
                <FlameIcon />
                Heat
              </button>
              <button
                type="button"
                className={style === 'dots' ? 'seg active' : 'seg'}
                aria-pressed={style === 'dots'}
                onClick={() => setStyle('dots')}
              >
                <PointerIcon />
                Dots
              </button>
            </div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={showPage}
              onChange={(e) => setShowPage(e.target.checked)}
            />
            <span className="switch-track" />
            Show page
          </label>
        </div>

        {pagesError && <p className="error">{pagesError}</p>}
        {error && <p className="error">{error}</p>}

        {data && (
          <div className="heat-stats">
            <span className="chip">
              <PointerIcon />
              {data.total_clicks} clicks
            </span>
            <span className="chip">
              <UsersIcon />
              {layout.sessions} {layout.sessions === 1 ? 'session' : 'sessions'}
            </span>
            <span className="chip">Plotted at {layout.refWidth}px width</span>
            {style === 'heat' && (
              <span className="legend">
                Fewer
                <span className="legend-bar" />
                More
              </span>
            )}
          </div>
        )}
      </section>

      <div ref={containerRef} className="heatmap-container">
        {!pageUrl && (
          <div className="card empty">
            <FlameIcon width={28} height={28} />
            <p>No click data yet</p>
            <span>Clicks on tracked pages will appear here.</span>
          </div>
        )}
        {pageUrl && (
          <div
            className="heatmap-stage"
            style={{ width: layout.refWidth * scale, height: layout.refHeight * scale }}
          >
            <div
              className="heatmap-inner"
              style={{
                width: layout.refWidth,
                height: layout.refHeight,
                transform: `scale(${scale})`,
              }}
            >
              {showPage && (
                // sandbox="" disables scripts, so the preview never fires tracking events.
                <iframe
                  title="Page preview"
                  src={pageUrl}
                  sandbox=""
                  width={layout.refWidth}
                  height={layout.refHeight}
                  className="heatmap-frame"
                />
              )}
              <canvas
                ref={canvasRef}
                width={layout.refWidth}
                height={layout.refHeight}
                className="heatmap-canvas"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
