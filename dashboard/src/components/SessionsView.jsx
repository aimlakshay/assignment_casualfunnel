import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import {
  colorFor,
  fmtDateTime,
  fmtDuration,
  fmtGap,
  fmtTime,
  pathOf,
  shortId,
} from '../format.js';
import {
  ActivityIcon,
  ClockIcon,
  EyeIcon,
  FileIcon,
  PointerIcon,
  RefreshIcon,
  UsersIcon,
} from './Icons.jsx';

function StatCard({ label, value, Icon, tone }) {
  return (
    <div className="stat">
      <span className={`stat-icon ${tone}`}>
        <Icon />
      </span>
      <div>
        <div className="stat-value">{value.toLocaleString()}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function SessionsView() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSessions(await api.sessions());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setEventsLoading(true);
    setEventsError('');
    api
      .sessionEvents(selected)
      .then((data) => !cancelled && setEvents(data))
      .catch((e) => !cancelled && setEventsError(e.message))
      .finally(() => !cancelled && setEventsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const totals = useMemo(
    () =>
      sessions.reduce(
        (t, s) => ({
          events: t.events + s.total_events,
          pageViews: t.pageViews + s.page_views,
          clicks: t.clicks + s.clicks,
        }),
        { events: 0, pageViews: 0, clicks: 0 }
      ),
    [sessions]
  );

  const maxEvents = Math.max(1, ...sessions.map((s) => s.total_events));
  const selectedSession = sessions.find((s) => s.session_id === selected);
  const pagesVisited = new Set(events.map((e) => e.page_url)).size;

  return (
    <div className="stack">
      <div className="stats">
        <StatCard label="Sessions" value={sessions.length} Icon={UsersIcon} tone="violet" />
        <StatCard label="Total events" value={totals.events} Icon={ActivityIcon} tone="indigo" />
        <StatCard label="Page views" value={totals.pageViews} Icon={EyeIcon} tone="sky" />
        <StatCard label="Clicks" value={totals.clicks} Icon={PointerIcon} tone="rose" />
      </div>

      <div className="sessions-layout">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Sessions</h2>
              <p className="card-sub">Select a session to see its user journey</p>
            </div>
            <button type="button" className="btn" onClick={loadSessions} disabled={loading}>
              <RefreshIcon className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          {loading && sessions.length === 0 && (
            <div className="skeleton-list">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton" />
              ))}
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div className="empty">
              <UsersIcon width={28} height={28} />
              <p>No sessions yet</p>
              <span>Open the demo page and click around to generate events.</span>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th className="num">Total events</th>
                    <th className="num">Views</th>
                    <th className="num">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.session_id}
                      className={s.session_id === selected ? 'row selected' : 'row'}
                      onClick={() => setSelected(s.session_id)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSelected(s.session_id)}
                    >
                      <td>
                        <div className="session-cell">
                          <span className="avatar" style={{ background: colorFor(s.session_id) }} />
                          <span className="mono" title={s.session_id}>
                            {shortId(s.session_id)}
                          </span>
                        </div>
                      </td>
                      <td className="muted">{fmtDateTime(s.first_seen)}</td>
                      <td className="muted">
                        {fmtDuration(new Date(s.last_seen) - new Date(s.first_seen))}
                      </td>
                      <td className="num">
                        <div className="count-cell">
                          <span className="bar">
                            <span style={{ width: `${(s.total_events / maxEvents) * 100}%` }} />
                          </span>
                          <strong>{s.total_events}</strong>
                        </div>
                      </td>
                      <td className="num">{s.page_views}</td>
                      <td className="num">{s.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card journey-card">
          <div className="card-head">
            <div>
              <h2>User journey</h2>
              <p className="card-sub">Events in the order they happened</p>
            </div>
          </div>

          {!selected && (
            <div className="empty">
              <ActivityIcon width={28} height={28} />
              <p>No session selected</p>
              <span>Pick a session from the list to replay its journey.</span>
            </div>
          )}

          {selected && (
            <div className="journey-summary">
              <span className="avatar lg" style={{ background: colorFor(selected) }} />
              <div className="journey-id">
                <div className="mono">{selected}</div>
                {selectedSession && (
                  <div className="chips">
                    <span className="chip">
                      <ClockIcon />
                      {fmtDuration(
                        new Date(selectedSession.last_seen) - new Date(selectedSession.first_seen)
                      )}
                    </span>
                    <span className="chip">
                      <ActivityIcon />
                      {selectedSession.total_events} events
                    </span>
                    {!eventsLoading && (
                      <span className="chip">
                        <FileIcon />
                        {pagesVisited} {pagesVisited === 1 ? 'page' : 'pages'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {eventsLoading && (
            <div className="skeleton-list">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" />
              ))}
            </div>
          )}
          {eventsError && <p className="error">{eventsError}</p>}

          {selected && !eventsLoading && !eventsError && (
            <ol className="timeline">
              {events.map((e, i) => {
                const isClick = e.event_type === 'click';
                const gap = i > 0 ? new Date(e.timestamp) - new Date(events[i - 1].timestamp) : 0;
                return (
                  <li key={e._id} className={`tl-item ${e.event_type}`}>
                    <span className="tl-dot">{isClick ? <PointerIcon /> : <EyeIcon />}</span>
                    <div className="tl-body">
                      <div className="tl-title">
                        <span className={`badge ${e.event_type}`}>{e.event_type}</span>
                        <span className="tl-path" title={e.page_url}>
                          {pathOf(e.page_url)}
                        </span>
                      </div>
                      <div className="tl-meta">
                        <span>
                          #{i + 1} · {fmtTime(e.timestamp)}
                        </span>
                        {i > 0 && <span>{fmtGap(gap)}</span>}
                        {isClick && (
                          <span className="coords">
                            x {e.x} · y {e.y}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
