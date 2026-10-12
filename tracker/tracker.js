/**
 * User analytics tracking script.
 *
 * Usage:
 *   <script src="https://your-api-host/tracker.js" async></script>
 *
 * Events are sent to <script origin>/api/events by default. Override with:
 *   <script src="..." data-endpoint="https://other-host/api/events"></script>
 *
 * Tracks:
 *   - page_view: once per page load
 *   - click:     every click, with x/y in document coordinates (pageX / pageY)
 */
(function () {
  'use strict';

  if (window.__analyticsTrackerLoaded) return;
  window.__analyticsTrackerLoaded = true;

  var SESSION_KEY = 'ua_session_id';
  var LAST_ACTIVITY_KEY = 'ua_last_activity';
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // new session after 30 min of inactivity

  var script = document.currentScript;
  var endpoint =
    (script && script.getAttribute('data-endpoint')) ||
    (script && script.src ? new URL('/api/events', script.src).href : '/api/events');

  // ---- storage helpers (localStorage may throw in private mode / when blocked) ----
  var memoryStore = {};
  function getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return memoryStore[key] || null;
    }
  }
  function setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      memoryStore[key] = value;
    }
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // Returns the current session id, starting a new session if none exists
  // or the previous one has been idle longer than SESSION_TIMEOUT_MS.
  function getSessionId() {
    var now = Date.now();
    var id = getItem(SESSION_KEY);
    var last = parseInt(getItem(LAST_ACTIVITY_KEY), 10);

    if (!id || !last || now - last > SESSION_TIMEOUT_MS) {
      id = generateId();
      setItem(SESSION_KEY, id);
    }
    setItem(LAST_ACTIVITY_KEY, String(now));
    return id;
  }

  // Page URL without query string or hash, so heatmap data for a page isn't
  // split across ?utm=... variants. "/dir/index.html" is reported as "/dir/".
  function currentPageUrl() {
    return window.location.origin + window.location.pathname.replace(/\/index\.html?$/, '/');
  }

  function dimensions() {
    var doc = document.documentElement;
    var body = document.body || {};
    return {
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      page_width: Math.max(doc.scrollWidth, body.scrollWidth || 0, doc.clientWidth),
      page_height: Math.max(doc.scrollHeight, body.scrollHeight || 0, doc.clientHeight),
    };
  }

  function send(event) {
    var body = JSON.stringify(event);

    // sendBeacon survives page navigation (e.g. clicking a link) and posts as
    // text/plain, which avoids a CORS preflight.
    if (navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon(endpoint, body)) return;
      } catch (e) {
        /* fall through to fetch */
      }
    }

    if (window.fetch) {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: body,
        keepalive: true,
        mode: 'cors',
      }).catch(function () {
        /* analytics must never break the host page */
      });
    }
  }

  function track(eventType, extra) {
    var event = {
      session_id: getSessionId(),
      event_type: eventType,
      page_url: currentPageUrl(),
      timestamp: new Date().toISOString(),
    };
    var dims = dimensions();
    for (var k in dims) event[k] = dims[k];
    if (extra) for (var j in extra) event[j] = extra[j];
    send(event);
  }

  function trackPageView() {
    track('page_view');
  }

  function onClick(e) {
    track('click', {
      x: Math.round(e.pageX),
      y: Math.round(e.pageY),
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }

  // Capture phase so clicks are recorded even if the page stops propagation.
  document.addEventListener('click', onClick, true);
})();
