import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const fmtDateTime = (d) => new Date(d).toLocaleString();
const fmtTime = (d) => new Date(d).toLocaleTimeString();

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function fmtGap(ms) {
  if (ms < 1000) return `+${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `+${s}s`;
  return `+${Math.floor(s / 60)}m ${s % 60}s`;
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

  return (
    <div className="sessions-layout">
      <section className="panel">
        <div className="panel-head">
          <h2>Sessions {!loading && <span className="muted">({sessions.length})</span>}</h2>
          <button type="button" className="btn" onClick={loadSessions} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {!loading && !error && sessions.length === 0 && (
          <p className="muted">No sessions yet. Open the demo page and click around.</p>
        )}

        {sessions.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th className="num">Total events</th>
                  <th className="num">Page views</th>
                  <th className="num">Clicks</th>
                  <th>Last active</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.session_id}
                    className={s.session_id === selected ? 'row selected' : 'row'}
                    onClick={() => setSelected(s.session_id)}
                  >
                    <td className="mono" title={s.session_id}>
                      {s.session_id.length > 8 ? `${s.session_id.slice(0, 8)}…` : s.session_id}
                    </td>
                    <td className="num strong">{s.total_events}</td>
                    <td className="num">{s.page_views}</td>
                    <td className="num">{s.clicks}</td>
                    <td>{fmtDateTime(s.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>User journey</h2>
        </div>

        {!selected && <p className="muted">Select a session to see its events in order.</p>}
        {selected && (
          <p className="muted mono small">
            Session {selected}
          </p>
        )}
        {eventsLoading && <p className="muted">Loading events…</p>}
        {eventsError && <p className="error">{eventsError}</p>}

        {selected && !eventsLoading && !eventsError && (
          <ol className="journey">
            {events.map((e, i) => (
              <li key={e._id} className="journey-item">
                <span className="step">{i + 1}</span>
                <div className="journey-body">
                  <div className="journey-top">
                    <span className={`badge ${e.event_type}`}>{e.event_type}</span>
                    <span className="path" title={e.page_url}>
                      {pathOf(e.page_url)}
                    </span>
                  </div>
                  <div className="journey-meta">
                    {fmtTime(e.timestamp)}
                    {i > 0 && (
                      <span className="muted">
                        {' '}
                        · {fmtGap(new Date(e.timestamp) - new Date(events[i - 1].timestamp))}
                      </span>
                    )}
                    {e.event_type === 'click' && (
                      <span className="muted">
                        {' '}
                        · x: {e.x}, y: {e.y}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
