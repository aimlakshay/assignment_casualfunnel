import { Router } from 'express';
import { Event } from '../models/Event.js';

const router = Router();

// GET /api/pages
// Distinct page URLs that have tracked events, for the heatmap page picker.
router.get('/pages', async (req, res, next) => {
  try {
    const pages = await Event.aggregate([
      {
        $group: {
          _id: '$page_url',
          clicks: { $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] } },
        },
      },
      { $sort: { clicks: -1, _id: 1 } },
      { $project: { _id: 0, page_url: '$_id', clicks: 1 } },
    ]);

    res.json(pages);
  } catch (err) {
    next(err);
  }
});

// GET /api/heatmap?page_url=<url>
// Click coordinates recorded on one page.
router.get('/heatmap', async (req, res, next) => {
  try {
    const { page_url } = req.query;
    if (typeof page_url !== 'string' || !page_url) {
      return res.status(400).json({ error: 'page_url query parameter is required' });
    }

    const clicks = await Event.find({ page_url, event_type: 'click' })
      .select('-_id x y viewport_width viewport_height page_width page_height timestamp session_id')
      .lean();

    res.json({ page_url, total_clicks: clicks.length, clicks });
  } catch (err) {
    next(err);
  }
});

export default router;
