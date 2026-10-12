import { Router } from 'express';
import { Event, EVENT_TYPES } from '../models/Event.js';

const router = Router();

const MAX_BATCH = 100;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const optNum = (v) => (isNum(v) ? v : undefined);

// Returns { event } on success or { error } describing the first problem found.
function validate(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'event must be an object' };

  const { session_id, event_type, page_url, timestamp, x, y } = raw;

  if (!isStr(session_id)) return { error: 'session_id is required' };
  if (!EVENT_TYPES.includes(event_type)) {
    return { error: `event_type must be one of: ${EVENT_TYPES.join(', ')}` };
  }
  if (!isStr(page_url)) return { error: 'page_url is required' };

  const ts = new Date(timestamp);
  if (timestamp === undefined || Number.isNaN(ts.getTime())) {
    return { error: 'timestamp must be a valid date (ISO string or epoch ms)' };
  }

  const event = {
    session_id: session_id.trim(),
    event_type,
    page_url: page_url.trim(),
    timestamp: ts,
    viewport_width: optNum(raw.viewport_width),
    viewport_height: optNum(raw.viewport_height),
    page_width: optNum(raw.page_width),
    page_height: optNum(raw.page_height),
  };

  if (event_type === 'click') {
    if (!isNum(x) || !isNum(y)) return { error: 'click events require numeric x and y' };
    event.x = x;
    event.y = y;
  }

  return { event };
}

// POST /api/events
// Body: a single event object, or an array of events (max 100).
router.post('/', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];

    if (items.length === 0) return res.status(400).json({ error: 'no events provided' });
    if (items.length > MAX_BATCH) {
      return res.status(413).json({ error: `max ${MAX_BATCH} events per request` });
    }

    const events = [];
    for (let i = 0; i < items.length; i++) {
      const { event, error } = validate(items[i]);
      if (error) return res.status(400).json({ error, index: i });
      events.push(event);
    }

    await Event.insertMany(events);
    res.status(201).json({ stored: events.length });
  } catch (err) {
    next(err);
  }
});

export default router;
