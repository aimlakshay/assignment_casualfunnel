import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { fmtDuration, pathOf } from '../format.js';
import { Donut, GroupedBarChart, Sparkline } from './Charts.jsx';
import { ActivityIcon, ClockIcon, EyeIcon, FlameIcon, PointerIcon, RefreshIcon, UsersIcon } from './Icons.jsx';

const RANGES = [
  { id: '24h', label: '24 hours' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
];

const SERIES = [
  { key: 'page_views', label: 'Page views', color: 'var(--view)' },
  { key: 'clicks', label: 'Clicks', color: 'var(--click)' },
];

const DEVICES = {
  desktop: { label: 'Desktop', color: 'var(--dev-desktop)' },
  mobile: { label: 'Mobile', color: 'var(--dev-mobile)' },
  tablet: { label: 'Tablet', color: 'var(--dev-tablet)' },
  unknown: { label: 'Unknown', color: 'var(--dev-unknown)' },
};

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Builds one bucket per hour/day for the selected range (empty ones included),
// then fills in the counts returned by the API.
function buildBuckets(stats) {
  if (!stats) return [];
  const byTime = new Map(stats.series.map((s) => [new Date(s.t).getTime(), s]));
  const now = new Date();
  const times = [];

  if (stats.unit === 'hour') {
    const end = new Date(now);
    end.setMinutes(0, 0, 0);
    for (let i = 23; i >= 0; i--) times.push(new Date(end.getTime() - i * 3600 * 1000));
  } else {
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    let start = new Date(end);
    if (stats.range === 'all') {
      if (stats.series.length) start = new Date(stats.series[0].t);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(start.getDate() - (stats.range === '30d' ? 29 : 6));
    }
    for (let d = new Date(start); d <= end && times.length < 366; d.setDate(d.getDate() + 1)) {
      times.push(new Date(d));
    }
  }

  return times.map((t) => {
    const s = byTime.get(t.getTime()) || {};
    const hourly = stats.unit === 'hour';
    return {
      t,
      label: hourly
        ? t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      tooltipLabel: hourly
        ? t.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : t.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      page_views: s.page_views || 0,
      clicks: s.clicks || 0,
      sessions: s.sessions || 0,
    };
  });
}

function KpiCard({ label, value, Icon, tone, trend, trendColor, note }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className={`stat-icon ${tone}`}>
          <Icon />
        </span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {note && <div className="kpi-note">{note}</div>}
      {trend && <Sparkline values={trend} color={trendColor} label={`${label} trend`} />}
    </div>
  );
}

export default function OverviewView({ onOpenHeatmap }) {
  const [range, setRange] = useState('7d');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .stats(range, TIME_ZONE)
      .then((s) => !cancelled && setStats(s))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  useEffect(load, [load]);

  const buckets = useMemo(() => buildBuckets(stats), [stats]);
  const totals = stats ? stats.totals : null;
  const deviceItems = (stats ? stats.devices : []).map((d) => ({
    key: d.device,
    label: (DEVICES[d.device] || DEVICES.unknown).label,
    color: (DEVICES[d.device] || DEVICES.unknown).color,
    value: d.sessions,
  }));
  const maxPageViews = Math.max(1, ...(stats ? stats.top_pages.map((p) => p.page_views) : [1]));
  const rangeLabel = RANGES.find((r) => r.id === range).label.toLowerCase();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>How visitors use your site {range === 'all' ? 'since tracking began' : `in the last ${rangeLabel}`}.</p>
        </div>
        <div className="page-actions">
          <div className="segmented small" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                className={range === r.id ? 'seg active' : 'seg'}
                aria-pressed={range === r.id}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn" onClick={load} disabled={loading} aria-label="Refresh">
            <RefreshIcon className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="kpis">
        <KpiCard
          label="Sessions"
          value={totals ? totals.sessions.toLocaleString() : '–'}
          Icon={UsersIcon}
          tone="violet"
          trend={buckets.map((b) => b.sessions)}
          trendColor="var(--accent)"
        />
        <KpiCard
          label="Page views"
          value={totals ? totals.page_views.toLocaleString() : '–'}
          Icon={EyeIcon}
          tone="sky"
          trend={buckets.map((b) => b.page_views)}
          trendColor="var(--view)"
        />
        <KpiCard
          label="Clicks"
          value={totals ? totals.clicks.toLocaleString() : '–'}
          Icon={PointerIcon}
          tone="rose"
          trend={buckets.map((b) => b.clicks)}
          trendColor="var(--click)"
        />
        <KpiCard
          label="Avg. session"
          value={totals ? fmtDuration(totals.avg_session_ms) : '–'}
          Icon={ClockIcon}
          tone="indigo"
          note={
            totals && totals.sessions
              ? `${(totals.events / totals.sessions).toFixed(1)} events per session`
              : 'No sessions yet'
          }
        />
      </div>

      <div className="overview-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Traffic</h2>
              <p className="card-sub">
                Page views and clicks per {stats && stats.unit === 'hour' ? 'hour' : 'day'}
              </p>
            </div>
            <div className="card-tools">
              <div className="legend-inline">
                {SERIES.map((s) => (
                  <span key={s.key}>
                    <span className="swatch" style={{ background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
              <button type="button" className="btn ghost-sm" onClick={() => setShowTable((v) => !v)}>
                {showTable ? 'Chart' : 'Table'}
              </button>
            </div>
          </div>

          {showTable ? (
            <div className="table-wrap flush">
              <table className="table">
                <thead>
                  <tr>
                    <th>{stats && stats.unit === 'hour' ? 'Hour' : 'Day'}</th>
                    <th className="num">Page views</th>
                    <th className="num">Clicks</th>
                    <th className="num">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets
                    .filter((b) => b.page_views || b.clicks)
                    .map((b) => (
                      <tr key={b.t.getTime()}>
                        <td>{b.tooltipLabel}</td>
                        <td className="num">{b.page_views}</td>
                        <td className="num">{b.clicks}</td>
                        <td className="num">{b.sessions}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <GroupedBarChart data={buckets} series={SERIES} />
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Devices</h2>
              <p className="card-sub">Sessions by screen width</p>
            </div>
          </div>
          {deviceItems.length ? (
            <Donut items={deviceItems} totalLabel="sessions" />
          ) : (
            <div className="empty">
              <ActivityIcon width={28} height={28} />
              <p>No sessions in this range</p>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Most popular pages</h2>
            <p className="card-sub">Ranked by page views</p>
          </div>
        </div>
        {stats && stats.top_pages.length === 0 && (
          <div className="empty">
            <EyeIcon width={28} height={28} />
            <p>No page views in this range</p>
            <span>Open the demo store and click around.</span>
          </div>
        )}
        {stats && stats.top_pages.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Page views</th>
                  <th className="num">Clicks</th>
                  <th className="num">Sessions</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stats.top_pages.map((p) => (
                  <tr key={p.page_url}>
                    <td>
                      <div className="page-cell" title={p.page_url}>
                        {pathOf(p.page_url)}
                      </div>
                    </td>
                    <td>
                      <div className="meter-cell">
                        <span className="meter">
                          <span style={{ width: `${(p.page_views / maxPageViews) * 100}%` }} />
                        </span>
                        <strong>{p.page_views}</strong>
                      </div>
                    </td>
                    <td className="num">{p.clicks}</td>
                    <td className="num">{p.sessions}</td>
                    <td className="num">
                      <button type="button" className="btn ghost-sm" onClick={() => onOpenHeatmap(p.page_url)}>
                        <FlameIcon />
                        Heatmap
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
