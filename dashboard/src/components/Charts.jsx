import { useEffect, useRef, useState } from 'react';

// Width of an element, kept up to date on resize.
export function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

// Round a max value up to a "nice" axis limit and return evenly spaced ticks.
function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

// Bar with rounded data-end (top) and a square base on the axis.
function barPath(x, y, w, h, r = 4) {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * Grouped bar chart (one group per time bucket).
 * series: [{ key, label, color }]; data: [{ label, tooltipLabel, [key]: number }]
 */
export function GroupedBarChart({ data, series, height = 260 }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState(null);

  const margin = { top: 12, right: 8, bottom: 28, left: 36 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;

  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const y = (v) => innerH - (v / top) * innerH;

  const band = data.length ? innerW / data.length : 0;
  const groupW = Math.min(band * 0.72, 44);
  const gap = 2;
  const barW = Math.max(2, (groupW - gap * (series.length - 1)) / series.length);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, innerW / 64)));

  const hovered = hover != null ? data[hover] : null;
  const tipLeft = hover != null ? margin.left + band * hover + band / 2 : 0;

  return (
    <div ref={wrapRef} className="chart" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Traffic over time">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {ticks.map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={innerW} className="grid-line" />
                <text x={-8} dy="0.32em" textAnchor="end" className="axis-label">
                  {t}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const x0 = band * i + (band - (barW * series.length + gap * (series.length - 1))) / 2;
              return (
                <g key={i}>
                  {hover === i && (
                    <rect x={band * i} y={0} width={band} height={innerH} className="hover-band" rx={6} />
                  )}
                  {series.map((s, j) => {
                    const v = d[s.key] || 0;
                    return (
                      <path
                        key={s.key}
                        d={barPath(x0 + j * (barW + gap), y(v), barW, innerH - y(v))}
                        fill={s.color}
                      />
                    );
                  })}
                  {i % labelEvery === 0 && (
                    <text x={band * i + band / 2} y={innerH + 18} textAnchor="middle" className="axis-label">
                      {d.label}
                    </text>
                  )}
                  {/* Hit target spans the whole column, larger than the bars. */}
                  <rect
                    x={band * i}
                    y={0}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                  />
                </g>
              );
            })}

            <line y1={innerH} y2={innerH} x2={innerW} className="axis-line" />
          </g>
        </svg>
      )}

      {hovered && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(Math.max(tipLeft, 80), width - 80), top: margin.top }}
        >
          <div className="tt-title">{hovered.tooltipLabel}</div>
          {series.map((s) => (
            <div key={s.key} className="tt-row">
              <span className="swatch" style={{ background: s.color }} />
              <span>{s.label}</span>
              <strong>{(hovered[s.key] || 0).toLocaleString()}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Small trend line for a stat tile (single series, no axes).
export function Sparkline({ values, color = 'var(--accent)', height = 40, label }) {
  const w = 100;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)]);
  const line = points.map(([x, py], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${py.toFixed(2)}`).join('');
  const area = `${line}L${w},${height}L0,${height}Z`;
  const id = useRef(`spark-${Math.random().toString(36).slice(2)}`).current;

  if (values.length < 2) return <div style={{ height }} />;

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      height={height}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function arcPath(cx, cy, rOuter, rInner, start, end) {
  const pt = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  // A full circle can't be drawn as one arc; split it in two.
  if (end - start >= Math.PI * 2 - 1e-6) {
    const mid = start + Math.PI;
    return arcPath(cx, cy, rOuter, rInner, start, mid) + arcPath(cx, cy, rOuter, rInner, mid, end);
  }
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = pt(rOuter, start);
  const [x2, y2] = pt(rOuter, end);
  const [x3, y3] = pt(rInner, end);
  const [x4, y4] = pt(rInner, start);
  return `M${x1},${y1}A${rOuter},${rOuter} 0 ${large} 1 ${x2},${y2}L${x3},${y3}A${rInner},${rInner} 0 ${large} 0 ${x4},${y4}Z`;
}

/** Donut with a legend. items: [{ key, label, value, color }] */
export function Donut({ items, totalLabel = 'total', size = 180 }) {
  const [active, setActive] = useState(null);
  const total = items.reduce((n, d) => n + d.value, 0);
  const r = size / 2;
  const thickness = 24;

  let angle = 0;
  const arcs = items.map((d) => {
    const sweep = total ? (d.value / total) * Math.PI * 2 : 0;
    const arc = { ...d, start: angle, end: angle + sweep };
    angle += sweep;
    return arc;
  });

  const shown = active != null ? items.find((d) => d.key === active) : null;
  const pct = (v) => (total ? Math.round((v / total) * 1000) / 10 : 0);

  return (
    <div className="donut-wrap">
      <div className="donut" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={`${totalLabel} by device`}>
          {total === 0 && (
            <circle cx={r} cy={r} r={r - thickness / 2 - 2} fill="none" className="donut-empty" strokeWidth={thickness} />
          )}
          {arcs.map((a) => (
            <path
              key={a.key}
              d={arcPath(r, r, r - 2, r - 2 - thickness, a.start, a.end)}
              fill={a.color}
              className={active && active !== a.key ? 'donut-seg dim' : 'donut-seg'}
              onMouseEnter={() => setActive(a.key)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <div className="donut-center">
          <div className="donut-value">{(shown ? shown.value : total).toLocaleString()}</div>
          <div className="donut-label">{shown ? `${shown.label} · ${pct(shown.value)}%` : totalLabel}</div>
        </div>
      </div>

      <ul className="legend-list">
        {items.map((d) => (
          <li
            key={d.key}
            className={active === d.key ? 'active' : ''}
            onMouseEnter={() => setActive(d.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="swatch" style={{ background: d.color }} />
            <span className="legend-name">{d.label}</span>
            <span className="legend-value">{d.value.toLocaleString()}</span>
            <span className="legend-pct">{pct(d.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
