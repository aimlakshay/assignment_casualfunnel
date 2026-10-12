export const fmtDateTime = (d) =>
  new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export function fmtDuration(ms) {
  if (ms < 1000) return ms > 0 ? '<1s' : '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Time between two consecutive events, e.g. "+350ms" or "+1m 5s".
export function fmtGap(ms) {
  return ms < 1000 ? `+${ms}ms` : `+${fmtDuration(ms)}`;
}

export function pathOf(url) {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url;
  }
}

export function shortId(id) {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

// Stable color per session id, used for the small session avatar.
export function colorFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 65% 55%)`;
}
