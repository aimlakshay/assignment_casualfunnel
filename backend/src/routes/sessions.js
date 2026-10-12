import { Router } from 'express';
import { Event } from '../models/Event.js';

const router = Router();

// GET /api/sessions
// Every session with its total event count, most recently active first.
router.get('/', async (req, res, next) => {
  try {
    const sessions = await Event.aggregate([
      {
        $group: {
          _id: '$session_id',
          total_events: { $sum: 1 },
          page_views: { $sum: { $cond: [{ $eq: ['$event_type', 'page_view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] } },
          first_seen: { $min: '$timestamp' },
          last_seen: { $max: '$timestamp' },
        },
      },
      { $sort: { last_seen: -1 } },
      {
        $project: {
          _id: 0,
          session_id: '$_id',
          total_events: 1,
          page_views: 1,
          clicks: 1,
          first_seen: 1,
          last_seen: 1,
        },
      },
    ]);

    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:sessionId/events
// All events of one session in chronological order (the user journey).
router.get('/:sessionId/events', async (req, res, next) => {
  try {
    const events = await Event.find({ session_id: req.params.sessionId })
      .sort({ timestamp: 1, _id: 1 })
      .select('-received_at')
      .lean();

    if (events.length === 0) return res.status(404).json({ error: 'session not found' });

    res.json(events);
  } catch (err) {
    next(err);
  }
});

export default router;
