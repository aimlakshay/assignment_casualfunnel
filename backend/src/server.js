import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import eventsRouter from './routes/events.js';
import sessionsRouter from './routes/sessions.js';
import heatmapRouter from './routes/heatmap.js';

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/user_analytics';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const app = express();

app.use(cors({ origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(',').map((o) => o.trim()) }));
// The tracker uses navigator.sendBeacon, which posts JSON as text/plain
// (this avoids a CORS preflight), so parse both content types as JSON.
app.use(express.json({ type: ['application/json', 'text/plain'], limit: '100kb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api/events', eventsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api', heatmapRouter);

// Tracking script and demo site, so a single process is enough to try everything.
app.get('/tracker.js', (req, res) => res.sendFile(path.join(rootDir, 'tracker/tracker.js')));
app.use('/demo', express.static(path.join(rootDir, 'demo')));

// Serve the built dashboard when present (npm run build in /dashboard).
const dashboardDist = path.join(rootDir, 'dashboard/dist');
if (fs.existsSync(dashboardDist)) app.use(express.static(dashboardDist));

app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

async function start() {
  await mongoose.connect(MONGODB_URI);
  await mongoose.model('Event').syncIndexes();
  console.log('Connected to MongoDB');

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    console.log(`Demo site:      http://localhost:${PORT}/demo/`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
