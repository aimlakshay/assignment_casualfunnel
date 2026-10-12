// Empty base means same origin: the Vite dev proxy in development, or the
// backend serving the built dashboard in production.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const TOKEN_KEY = 'ua_dashboard_token';

// localStorage can throw (private mode, blocked storage); fall back to memory.
let memoryToken = null;
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return memoryToken;
    }
  },
  set(token) {
    memoryToken = token;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* memory fallback already set */
    }
  },
};

// Fired when the server rejects the stored token, so the app can show the login screen.
export const AUTH_EXPIRED_EVENT = 'ua:auth-expired';

async function request(path, options = {}) {
  const token = tokenStore.get();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    tokenStore.set(null);
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

const get = (path) => request(path);

export const api = {
  authStatus: () => get('/api/auth/status'),
  login: (password) =>
    request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }),
  sessions: () => get('/api/sessions'),
  sessionEvents: (sessionId) => get(`/api/sessions/${encodeURIComponent(sessionId)}/events`),
  pages: () => get('/api/pages'),
  heatmap: (pageUrl) => get(`/api/heatmap?page_url=${encodeURIComponent(pageUrl)}`),
  stats: (range, tz) => get(`/api/stats?range=${encodeURIComponent(range)}&tz=${encodeURIComponent(tz)}`),
};
