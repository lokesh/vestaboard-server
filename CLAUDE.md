# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server**: `npm run dev` (Nodemon hot-reload)
- **Production**: `npm start` (runs `node src/app.js`)
- **Lint**: `npm run lint` runs `eslint .` but no ESLint config exists, so it currently fails
- No test framework is configured. Verify changes by running the server with debug mode on (board writes print to the console instead of hitting the hardware).

## Environment

- Node.js with ES Modules (`"type": "module"` in package.json). All imports need the `.js` extension.
- Express server on port 3000 (configurable via `PORT`)
- Copy `.env.example` to `.env`. Redis credentials are effectively required: every service imports `redisClient.js`, which creates the Upstash client at module load.
- Timezone is centralized in `src/utils/timezone.js` as `America/Los_Angeles`. Use `nowInTz()`, `toTz()`, and `formatInTz()` from `date-fns-tz`. Never use `new Date(date.toLocaleString(..., {timeZone}))` — it's unreliable across platforms. Cron jobs also pass `timezone: 'America/Los_Angeles'` to node-cron.

## Architecture

The app controls a [Vestaboard](https://www.vestaboard.com/) display through a mode-based system. A web interface (Vue 3 via CDN) lets users switch between display modes, and a cron scheduler keeps the board updated.

**Flow**: Web UI → Express API → ModeController → BoardService → Vestaboard API

### Singletons and startup order

`modeController` and `boardService` are module-level singleton instances. `app.js` calls `start()`, which awaits `modeController.initialize()` (reads the saved mode from Redis and re-enters it, starting its cron job) before `app.listen`. `boardService` loads its debug flag from Redis in its constructor without awaiting, so the flag may be stale for the first few ms. `GET /api/status` re-reads both mode and debug flag from Redis on every call and resyncs the in-memory singletons.

### Authentication

Token-based auth protects all `/api/*` routes. Set `APP_SECRET` to enable; if unset, auth is disabled and login returns a dummy token. The token is a deterministic HMAC of the secret (not per-session). The frontend stores it in localStorage under `vestaboard_token` and sends it as a `Bearer` header through its `authFetch` helper. `/api/auth/login` and `/api/auth/check` are exempt. The OAuth callback lives at `/auth/google/callback` (outside `/api`) because Google redirects there directly.

### Board Format

The Vestaboard is a 6-row × 22-column grid. Each cell is an integer character code (0–70): 0=blank, 1–26=A–Z, 27–36=1–9 then 0, 37–60=punctuation, 62=°, 63–70=colors (red, orange, yellow, green, blue, violet, white, black). Color emoji input (`🟥🟧🟨🟩🟦🟪⬜⬛`) maps to the same codes. All board content is a `number[6][22]` matrix.

**Two write paths in `boardService`**:
- `updateBoard(text)` — the path every mode uses. Splits on `\n`, uppercases, pads/truncates each line to 22 chars and 6 rows, maps each char via `charMap` (unknown chars become blank), then POSTs the matrix. Honors debug mode.
- `sendMessage(text)` — used by `POST /api/board/message`. Sends `{ text }` to Vestaboard's own text endpoint and lets Vestaboard lay it out. Does **not** honor debug mode.

### API Routes (`src/app.js`)

- `POST /api/auth/login` — Authenticate with password (returns token)
- `GET /api/auth/check` — Check if current token is valid
- `GET /` — Serve web UI
- `GET /api/status` — Current mode, debug state, cron info
- `POST /api/mode` — Switch display mode (`{ mode: "CLOCK" }`)
- `POST /api/debug/toggle` — Toggle debug mode
- `GET /api/board/content` — Current board matrix
- `POST /api/board/message` — Send raw text to board
- `POST /api/pattern/test` — Test pattern matching for a mode
- `GET /api/auth/google/start` — Get Google OAuth URL (protected)
- `GET /auth/google/callback` — Google OAuth redirect handler (unprotected)
- `GET /api/calendar/events` — Fetch upcoming calendar events

### Key Files

- `src/app.js` — Express server, all API routes, async initialization
- `src/middleware/auth.js` — Token-based authentication middleware
- `src/controllers/modeController.js` — Core orchestration: mode switching, cron scheduling, one `updateX()` method per mode, plus TODAY-mode helpers (holidays, birthdays, weather summary)
- `src/services/boardService.js` — Vestaboard API client, character encoding, debug mode
- `src/services/weatherService.js` — NWS, Visual Crossing, and Sunrise-Sunset fetchers with Redis caching
- `src/services/calendarService.js` — Google Calendar OAuth2 integration; reads all calendars on the account
- `src/utils/redisClient.js` — Upstash Redis for mode, debug state, Google tokens, and weather cache
- `src/utils/timezone.js` — Centralized timezone handling via date-fns-tz
- `src/utils/boardCharacters.js` — Character map (codes 0–70) and the `checkBoardPattern` matcher
- `src/utils/cronSchedules.js` — Cron schedule definitions per mode
- `src/public/index.html` — Vue 3 single-page app (all frontend JS inline; styles in `styles.css`)

### Display Modes (`src/types/Mode.js`)

`MANUAL`, `CLOCK`, `5DAYWEATHER`, `1DAYWEATHER`, `CALENDAR`, `TODAY`, `KIERAN`. Note the enum keys differ from the string values (`Mode.FIVEDAY_WEATHER === '5DAYWEATHER'`); `CronSchedules` and the API are keyed by the string values.

**Cron schedules** (PST/PDT): CLOCK=every minute, CALENDAR=every hour, 5DAYWEATHER=6am/noon/6pm, 1DAYWEATHER, TODAY & KIERAN=6am/9am/noon/3pm/6pm, MANUAL=none.

**Adding a mode** touches five places: `Mode.js`, `cronSchedules.js`, a new `PatternMatcher` subclass plus a case in `PatternMatcherFactory`, an `updateX(initialUpdate)` method and `setMode` case in `modeController`, and the mode picker in `index.html`.

### Pattern Matching System

Before each cron update, the controller reads the live board and validates it against the current mode's pattern via `_shouldUpdate()`. The initial update on mode switch always skips this check. On mismatch it increments a per-mode counter; after 3 consecutive mismatches (`MISMATCH_THRESHOLD`), cron jobs stop and mode reverts to `MANUAL`. This prevents overwriting manually-set content while tolerating transient mismatches. Switching modes resets the counters.

**Pattern DSL** (`checkBoardPattern` in `boardCharacters.js`): a pattern is a 6×22 array of strings. `''` matches anything, a single character matches that literal (case-insensitive), and the tokens `a-z`, `0-9`, `COLOR`, `emoji`, and `time` match a class. An all-empty pattern row is skipped entirely. Matchers typically combine a loose pattern with extra checks in `matches()`.

### Debug Mode

Toggle via `POST /api/debug/toggle`. When enabled, `updateBoard` prints an ASCII grid to the console instead of calling the Vestaboard API. State persists in Redis. Reads (`getCurrentBoardContent`) still hit the real API, so pattern matching will see real hardware content even in debug mode.

### Weather

Location is hardcoded to San Francisco: NWS gridpoint `MTR/84,105` and lat/lng `37.7749,-122.4194` for Visual Crossing and Sunrise-Sunset. Successful responses are cached in Redis under `WEATHER_CACHE:{forecast|hourly|sun|visualcrossing}` with a 6-hour TTL, and an API failure falls back to the cache. TODAY mode prefers Visual Crossing (past + future hours for today) and falls back to NWS hourly if that call fails.

### Formatters

- `src/utils/weatherFormatter.js` — Normalizes verbose NWS descriptions to fit 14-char max (e.g., "Thunderstorms"→"Storm", "Scattered"→"Light"). TODAY mode has its own 10-char variant inside `modeController`.
- `src/utils/calendarFormatter.js` — Formats up to 5 events with color emoji, time, and truncated titles (14-char max)
- `src/utils/kieranFormatter.js` — KIERAN mode (kid-friendly daily board): weekday + date, school-day indicator, morning/afternoon/evening temps with a condition color, and a callout row. Rain always owns the callout; a birthday takes it otherwise, or the school row on a rainy weekend. Pure function of `{ zonedNow, hourlyData, noSchoolReason, birthdays }`, so it can be tested without network.
- `src/config/schoolCalendar.js` — School year bounds and break ranges for KIERAN mode. No school = weekend, federal holiday (`getHolidayForDate`), listed break, or outside the school year. Update each school year.

### Frontend

Vue 3 is loaded from unpkg at runtime (no build step). The app polls `/api/status` and `/api/board/content` every 15 seconds. All API calls go through `authFetch`, which attaches the stored token.

### External Services

- **Vestaboard API** — Board read/write (`VESTABOARD_READ_WRITE_API_KEY`)
- **Upstash Redis** — State persistence across restarts. Getters fail soft (return defaults on error); weather cache writes are best-effort.
- **Google Calendar** — OAuth2 flow with token refresh; refreshed tokens are written back to Redis
- **NWS + Visual Crossing** — Weather data
- **Sunrise-Sunset API** — Sun times for day/night emoji selection

All external API calls have a 10-second timeout (`AbortSignal.timeout`).

### Redis Keys (`src/utils/redisClient.js`)

`CURRENT_MODE`, `DEBUG_MODE`, `GOOGLE_ACCESS_TOKEN`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_TOKEN_EXPIRY`, `WEATHER_CACHE:*`

## Deployment

Hosted on Railway at https://108space.com/. Redis via Upstash. Set `GOOGLE_REDIRECT_URI=https://108space.com/auth/google/callback` on Railway and in Google Cloud Console for calendar auth.
