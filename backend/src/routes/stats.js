import { Router } from 'express';
import { Event } from '../models/Event.js';

const router = Router();

const RANGES = {
  '24h': { ms: 24 * 60 * 60 * 1000, unit: 'hour' },
  '7d': { ms: 7 * 24 * 60 * 60 * 1000, unit: 'day' },
  '30d': { ms: 30 * 24 * 60 * 60 * 1000, unit: 'day' },
  all: { ms: null, unit: 'day' },
};

const isPageView = { $eq: ['$event_type', 'page_view'] };
const isClick = { $eq: ['$event_type', 'click'] };
const countIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });

function validTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

// GET /api/stats?range=24h|7d|30d|all&tz=<IANA time zone>
// Aggregates for the Overview page: totals, traffic over time, devices and top pages.
router.get('/stats', async (req, res, next) => {
  try {
    const rangeKey = RANGES[req.query.range] ? req.query.range : '7d';
    const { ms, unit } = RANGES[rangeKey];
    const timezone = validTimeZone(req.query.tz);
    const match = ms ? { timestamp: { $gte: new Date(Date.now() - ms) } } : {};

    const [result] = await Event.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                events: { $sum: 1 },
                page_views: countIf(isPageView),
                clicks: countIf(isClick),
              },
            },
          ],

          sessions: [
            {
              $group: {
                _id: '$session_id',
                first: { $min: '$timestamp' },
                last: { $max: '$timestamp' },
                width: { $max: '$viewport_width' },
              },
            },
            {
              $project: {
                duration: { $subtract: ['$last', '$first'] },
                device: {
                  $switch: {
                    branches: [
                      { case: { $not: ['$width'] }, then: 'unknown' },
                      { case: { $lt: ['$width', 768] }, then: 'mobile' },
                      { case: { $lt: ['$width', 1024] }, then: 'tablet' },
                    ],
                    default: 'desktop',
                  },
                },
              },
            },
            {
              $group: {
                _id: '$device',
                sessions: { $sum: 1 },
                total_duration: { $sum: '$duration' },
              },
            },
          ],

          series: [
            {
              $group: {
                _id: { $dateTrunc: { date: '$timestamp', unit, timezone } },
                page_views: countIf(isPageView),
                clicks: countIf(isClick),
                session_ids: { $addToSet: '$session_id' },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                t: '$_id',
                page_views: 1,
                clicks: 1,
                sessions: { $size: '$session_ids' },
              },
            },
          ],

          top_pages: [
            {
              $group: {
                _id: '$page_url',
                page_views: countIf(isPageView),
                clicks: countIf(isClick),
                session_ids: { $addToSet: '$session_id' },
              },
            },
            { $sort: { page_views: -1, clicks: -1, _id: 1 } },
            { $limit: 8 },
            {
              $project: {
                _id: 0,
                page_url: '$_id',
                page_views: 1,
                clicks: 1,
                sessions: { $size: '$session_ids' },
              },
            },
          ],
        },
      },
    ]);

    const totals = result.totals[0] || { events: 0, page_views: 0, clicks: 0 };
    const sessionCount = result.sessions.reduce((n, d) => n + d.sessions, 0);
    const totalDuration = result.sessions.reduce((n, d) => n + d.total_duration, 0);

    res.json({
      range: rangeKey,
      unit,
      timezone,
      totals: {
        sessions: sessionCount,
        events: totals.events,
        page_views: totals.page_views,
        clicks: totals.clicks,
        avg_session_ms: sessionCount ? Math.round(totalDuration / sessionCount) : 0,
      },
      series: result.series,
      devices: result.sessions
        .map((d) => ({ device: d._id, sessions: d.sessions }))
        .sort((a, b) => b.sessions - a.sessions),
      top_pages: result.top_pages,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
