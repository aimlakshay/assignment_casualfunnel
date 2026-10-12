# User Analytics App

A small full-stack app that tracks user interactions on a webpage (page views and clicks)
and shows them in a dashboard: a list of sessions with the user journey for each, and a
click heatmap for each page.

```
assignment/
├── tracker/tracker.js   # JavaScript tracking snippet added to any webpage
├── demo/                # Demo store (2 pages) with the tracker installed
├── backend/             # Node.js + Express API, MongoDB via Mongoose
└── dashboard/           # React (Vite) dashboard: Sessions view + Heatmap view
```

## Tech stack

| Part      | Tech |
|-----------|------|
| Tracker   | Plain JavaScript (no dependencies), `localStorage`, `navigator.sendBeacon` |
| Backend   | Node.js 18+, Express 4, Mongoose 8 |
| Database  | MongoDB |
| Dashboard | React 18, Vite 5 (no UI library), HTML canvas for the heatmap |

## Setup

### Prerequisites

- Node.js 18 or newer
- A MongoDB database, either:
  - local: `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`, or
  - a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (copy its connection string)

### 1. Backend

```bash
cd backend
cp .env.example .env      # set MONGODB_URI if not using local MongoDB
npm install
npm start                 # http://localhost:4000
```

The backend also serves:
- the tracking script at `http://localhost:4000/tracker.js`
- the demo site at `http://localhost:4000/demo/`

### 2. Dashboard

```bash
cd dashboard
npm install
npm run dev               # http://localhost:5173 (proxies /api to :4000)
```

### 3. Try it

1. Open `http://localhost:4000/demo/`, click around, go to **Products**, add items to the cart.
2. Open the dashboard at `http://localhost:5173`.
   - **Sessions**: every session with its total event count. Click a row to see its events in order.
   - **Heatmap**: pick a page URL to see where users clicked.

### Single-process mode (optional)

After `npm run build` in `dashboard/`, the backend also serves the built dashboard, so
`http://localhost:4000/` is the dashboard and only one server needs to run.

## Adding the tracker to a webpage

```html
<script src="https://YOUR-API-HOST/tracker.js" async></script>
```

By default, events are sent to `/api/events` on the host the script was loaded from.
To send them somewhere else:

```html
<script src="https://cdn.example.com/tracker.js" data-endpoint="https://YOUR-API-HOST/api/events" async></script>
```

Each event contains:

| Field | Description |
|-------|-------------|
| `session_id` | UUID kept in `localStorage` (`ua_session_id`) |
| `event_type` | `page_view` or `click` |
| `page_url` | `origin + pathname` of the page |
| `timestamp` | ISO 8601 time on the client |
| `x`, `y` | Click position in document coordinates (`pageX`/`pageY`), clicks only |
| `viewport_width`, `viewport_height`, `page_width`, `page_height` | Used to scale the heatmap |

## API

Base URL: `http://localhost:4000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/events` | Store one event (object) or a batch (array, max 100). Returns `201 { stored }`. |
| `GET`  | `/api/sessions` | All sessions with `total_events`, `page_views`, `clicks`, `first_seen`, `last_seen`, most recent first. |
| `GET`  | `/api/sessions/:sessionId/events` | All events of a session in chronological order (the user journey). |
| `GET`  | `/api/heatmap?page_url=<url>` | Click data (`x`, `y`, dimensions) for one page. |
| `GET`  | `/api/pages` | Distinct tracked page URLs with click counts (used by the heatmap page picker). |
| `GET`  | `/api/health` | Server and database status. |

Example:

```bash
curl -X POST http://localhost:4000/api/events \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"abc","event_type":"click","page_url":"https://shop.com/","timestamp":"2026-10-12T10:00:00Z","x":120,"y":340}'
```

Invalid events return `400` with a message (for example, a click without `x`/`y`).

## Database

All events are stored in a single `events` collection:

```js
{
  session_id: String,       // required
  event_type: 'page_view' | 'click',
  page_url: String,
  timestamp: Date,
  x: Number, y: Number,     // clicks only
  viewport_width, viewport_height, page_width, page_height: Number,
  received_at: Date         // set by the server
}
```

Indexes:
- `{ session_id: 1, timestamp: 1 }`: fetching a session's journey in order
- `{ page_url: 1, event_type: 1 }`: fetching clicks for a page's heatmap

Session lists are computed with an aggregation (`$group` by `session_id`) instead of being
stored in a separate collection.

## Assumptions and trade-offs

- **Session definition**: a session ID lives in `localStorage` and is renewed after
  **30 minutes of inactivity**. It is shared across tabs of the same origin and does not
  follow the user across different domains (the assignment allowed cookie or localStorage).
- **Page URL normalization**: the query string and hash are removed (`origin + pathname`),
  so `/products?utm_source=x` and `/products` share one heatmap. Single-page apps that
  change routes without reloading only record the first `page_view`. Route-change tracking
  was left out to keep the scope as specified.
- **Sending events**: each event is sent right away with `navigator.sendBeacon` (falling
  back to `fetch` with `keepalive`), so clicks on links that leave the page are still
  delivered. Beacons are sent as `text/plain` to avoid CORS preflight requests, and the
  API parses that as JSON. Batching would cut down requests on busy pages, and the API
  already accepts arrays.
- **Heatmap coordinates**: clicks are stored as document coordinates (`pageX`/`pageY`)
  with the viewport size. The heatmap uses the most common viewport width as its reference
  and scales other clicks horizontally. That is approximate for responsive layouts that
  change shape at different widths. Production tools usually group clicks by device or
  breakpoint, or attach them to DOM elements.
- **Heatmap background**: the page is shown behind the dots in a sandboxed `<iframe>`
  (scripts off, so viewing the heatmap never creates tracking events). Sites that send
  `X-Frame-Options`/CSP `frame-ancestors` will show a blank background, but the dots still render.
- **Timestamps** come from the client clock, which keeps journey ordering true to what the
  user did. The server also stores `received_at`.
- **No auth or rate limiting** on the ingestion endpoint. Anyone with the URL can post
  events. A real deployment would add per-site keys, rate limits and bot filtering.
- **No pagination** on the sessions list. That's fine at demo scale; a larger dataset would
  need pagination or a date range filter.

## Deployment (optional)

One way to host it:
1. Create a free MongoDB Atlas cluster and copy its connection string.
2. Deploy the repo to Render/Railway as a Node web service:
   - Build command: `cd dashboard && npm install && npm run build && cd ../backend && npm install`
   - Start command: `cd backend && npm start`
   - Environment: `MONGODB_URI=<atlas connection string>`
3. The same service then serves the dashboard (`/`), the API (`/api/*`), the tracker
   (`/tracker.js`) and the demo site (`/demo/`).
