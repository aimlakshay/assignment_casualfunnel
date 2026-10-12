// Empty base means same origin: the Vite dev proxy in development, or the
// backend serving the built dashboard in production.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const api = {
  sessions: () => get('/api/sessions'),
  sessionEvents: (sessionId) => get(`/api/sessions/${encodeURIComponent(sessionId)}/events`),
  pages: () => get('/api/pages'),
  heatmap: (pageUrl) => get(`/api/heatmap?page_url=${encodeURIComponent(pageUrl)}`),
};
