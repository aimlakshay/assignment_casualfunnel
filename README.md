# User Analytics App

A small full-stack app that tracks user interactions on a webpage (page views and clicks)
and shows them in a dashboard: a list of sessions with the user journey for each, and a
click heatmap for each page.

```
assignment/
├── tracker/tracker.js   # JavaScript tracking snippet added to any webpage
├── demo/                # Demo store (home + products, working cart) with the tracker installed
├── backend/             # Node.js + Express API, MongoDB via Mongoose
└── dashboard/           # React (Vite) dashboard: Overview, Sessions, Heatmap (password protected)
```

## Tech stack

| Part      | Tech |
|-----------|------|
| Tracker   | Plain JavaScript (no dependencies), `localStorage`, `navigator.sendBeacon` |
| Backend   | Node.js 18+, Express 4, Mongoose 8 |
| Database  | MongoDB |
| Dashboard | React 18, Vite 5, plain CSS (no UI library, light and dark themes), HTML canvas for the heatmap |

## Setup

### Prerequisites

- Node.js 18 or newer
- A MongoDB database, either:
  - local (macOS / Homebrew):
    ```bash
    brew tap mongodb/brew
    brew trust mongodb/brew          # newer Homebrew versions require trusting third-party taps
    brew install mongodb-community
    brew services start mongodb/brew/mongodb-community
    ```
    or
  - a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (copy its connection string)

### 1. Backend

```bash
cd backend
cp .env.example .env      # set MONGODB_URI and DASHBOARD_PASSWORD
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

1. Open `http://localhost:4000/demo/`, click around, go to **Products** and add items to the
   cart. The **Cart** button in the header opens a drawer where you can change quantities,
   remove items and check out (demo only: nothing is charged). The cart is kept in
   `localStorage`, so it carries over between pages.
2. Open the dashboard at `http://localhost:5173` and sign in with the `DASHBOARD_PASSWORD`
   from `backend/.env`.
   - **Overview**: KPI tiles with trend lines (sessions, page views, clicks, average session
     length), a traffic chart per hour/day with a table view, sessions by device (from screen
     width), and the most popular pages with a shortcut to each page's heatmap. Ranges: 24 hours,
     7 days, 30 days, all time.
   - **Sessions**: summary stats (sessions, events, page views, clicks) and a table of
     every session with its total event count and duration. Click a row to see its user journey
     as a timeline, in order, with the time between steps and click coordinates.
   - **Heatmap**: pick a page URL to see where users clicked, as a **heat** gradient
     (more clicks look hotter) or as individual **dots**, drawn over a preview of the page.

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
| `GET`  | `/api/stats?range=24h\|7d\|30d\|all&tz=<IANA zone>` | Overview data: totals, traffic per hour/day, devices, top pages. |
| `GET`  | `/api/auth/status` | Whether a password is required and whether the sent token is valid. |
| `POST` | `/api/auth/login` | `{ "password": "..." }` → `{ token, expires_at }` (token valid for 12 hours). |
| `GET`  | `/api/health` | Server and database status. |

When `DASHBOARD_PASSWORD` is set, every `GET` data endpoint above (sessions, events, pages,
heatmap, stats) requires an `Authorization: Bearer <token>` header from `/api/auth/login`.
`POST /api/events` stays public so the tracker works on any website.

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
  and a trailing `index.html` is dropped, so `/products?utm_source=x` and `/products` share
  one heatmap, and so do `/demo/index.html` and `/demo/`. Single-page apps that
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
- **Dashboard login is a single shared password** (`DASHBOARD_PASSWORD`), not user
  accounts. Tokens are signed with HMAC-SHA256, expire after 12 hours, and are kept in the
  browser's `localStorage`. Login attempts are limited to 10 per 15 minutes per IP. Leaving
  `DASHBOARD_PASSWORD` empty turns the login off.
- **The ingestion endpoint is public**, as it must be for a tracking script: anyone with the
  URL can post events. A real deployment would add per-site keys, rate limits and bot filtering.
- **Device type is inferred from screen width** (under 768px mobile, under 1024px tablet,
  otherwise desktop), using the widest viewport seen in the session. No user-agent parsing.
- **No pagination** on the sessions list. That's fine at demo scale; a larger dataset would
  need pagination or a date range filter.

## Troubleshooting

- **Server hangs at startup or fails with `ECANCELED`** on macOS: if the project is inside
  an iCloud-synced folder (Desktop or Documents with "Desktop & Documents Folders" on),
  iCloud slows down or blocks reads of the thousands of files in `node_modules`. Keep the
  project in a folder that isn't synced, e.g. clone it into `~/code`.

## Deployment on Render

The repo includes a Render Blueprint ([`render.yaml`](render.yaml)) that creates one free
web service. That service serves the dashboard (`/`), the API (`/api/*`), the tracker
(`/tracker.js`) and the demo store (`/demo/`).

1. **MongoDB Atlas** (free M0 cluster)
   - Create a cluster, then a database user under *Database Access*.
   - Under *Network Access*, allow `0.0.0.0/0`, because Render's outbound IPs change.
   - Copy the connection string (*Connect → Drivers*) and add the database name before
     the `?`, e.g. `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/user_analytics?retryWrites=true&w=majority`
2. **Render**
   - *New → Blueprint*, connect this GitHub repo.
   - When asked for `MONGODB_URI`, paste the Atlas connection string; for
     `DASHBOARD_PASSWORD`, choose the password for the dashboard. Then click *Apply*.
   - Render runs `npm run build` (installs both apps and builds the dashboard) and
     `npm start` (starts the Express server), and uses `/api/health` as the health check.
3. Open `https://<your-service>.onrender.com/demo/`, click around, then open
   `https://<your-service>.onrender.com/` to see the dashboard.

Free Render services go to sleep after about 15 minutes without traffic, so the first
request after that can take up to a minute.
