import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const DOT_RADIUS = 8;

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

export default function HeatmapView() {
  const [pages, setPages] = useState([]);
  const [pagesError, setPagesError] = useState('');
  const [pageUrl, setPageUrl] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPage, setShowPage] = useState(true);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
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
    setLoading(true);
    setError('');
    api
      .heatmap(url)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
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
      ...points.map((p) => p.y + DOT_RADIUS * 2)
    );

    return { refWidth, refHeight, points };
  }, [data]);

  const scale = containerWidth ? Math.min(1, containerWidth / layout.refWidth) : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of layout.points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(153, 27, 27, 0.8)';
      ctx.stroke();
    }
  }, [layout]);

  return (
    <section className="panel">
      <div className="panel-head heatmap-controls">
        <h2>Click heatmap</h2>
        <div className="controls">
          <label className="field">
            <span>Page URL</span>
            <select value={pageUrl} onChange={(e) => setPageUrl(e.target.value)}>
              {pages.length === 0 && <option value="">No pages tracked yet</option>}
              {pages.map((p) => (
                <option key={p.page_url} value={p.page_url}>
                  {p.page_url} ({p.clicks} clicks)
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={showPage}
              onChange={(e) => setShowPage(e.target.checked)}
            />
            Show page behind clicks
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              loadPages();
              loadHeatmap(pageUrl);
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {pagesError && <p className="error">{pagesError}</p>}
      {error && <p className="error">{error}</p>}
      {data && (
        <p className="muted small">
          {data.total_clicks} clicks · plotted at {layout.refWidth}px viewport width
          {loading && ' · loading…'}
        </p>
      )}

      <div ref={containerRef} className="heatmap-container">
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
    </section>
  );
}
