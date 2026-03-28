# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server**: `npm run dev` (uses Nodemon for hot-reload)
- **Production**: `npm start` (runs `node src/app.js`)
- **Lint**: `npm run lint` (ESLint — no config file exists yet)
- No test framework is configured.

## Environment

- Node.js with ES Modules (`"type": "module"` in package.json)
- Express server on port 3000 (configurable via `PORT` env var)
- Copy `.env.example` to `.env` for required credentials
- Timezone is centralized in `src/utils/timezone.js` as `America/Los_Angeles` — all date operations use `date-fns-tz` via `nowInTz()`, `toTz()`, and `formatInTz()`. Never use `new Date(date.toLocaleString(..., {timeZone}))` — it's unreliable across platforms.

## Architecture

The app controls a [Vestaboard](https://www.vestaboard.com/) display through a mode-based system. A web interface (Vue 3 via CDN) lets users switch between display modes, and a cron scheduler keeps the board updated.

**Flow**: Web UI → Express API → ModeController → BoardService → Vestaboard API

### Authentication

Token-based auth protects all `/api/*` routes. Set `APP_SECRET` env var to enable. If unset, auth is disabled. The frontend stores a session token in localStorage after login. OAuth callback (`/auth/google/callback`) is exempt from API auth since Google redirects there directly.

### Board Format

The Vestaboard is a 6-row × 22-column grid. Each cell is an integer character code (0–70): 0=blank, 1–26=A–Z, 27–36=0–9, 37–60=punctuation, 63–70=colors (red, orange, yellow, green, blue, violet, white, black). Color emoji input (`🟥🟧🟨🟩🟦🟪⬜⬛`) is also supported. All board content is represented as a `number[6][22]` matrix.

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
- `src/controllers/modeController.js` — Core orchestration: mode switching, cron scheduling, content updates
- `src/services/boardService.js` — Vestaboard API client, character encoding, debug mode
- `src/services/weatherService.js` — Fetches from NWS, Visual Crossing, and Sunrise-Sunset APIs with caching
- `src/services/calendarService.js` — Google Calendar OAuth2 integration
- `src/utils/redisClient.js` — Upstash Redis for persisting current mode, debug state, and weather cache
- `src/utils/timezone.js` — Centralized timezone handling via date-fns-tz
- `src/utils/boardCharacters.js` — Vestaboard character encoding map (codes 0-70) and pattern matching helpers
- `src/utils/cronSchedules.js` — Cron schedule definitions per mode
- `src/public/index.html` — Vue 3 single-page app (all frontend in one file)

### Display Modes (`src/types/Mode.js`)

`MANUAL`, `CLOCK`, `5DAYWEATHER`, `1DAYWEATHER`, `CALENDAR`, `TODAY` — each mode has a dedicated update function in modeController, a pattern matcher, and a cron schedule.

**Cron schedules** (PST/PDT): CLOCK=every minute, CALENDAR=every hour, 5DAYWEATHER=6am/noon/6pm, 1DAYWEATHER & TODAY=6am/9am/noon/3pm/6pm, MANUAL=none.

### Pattern Matching System

Factory pattern (`src/patterns/PatternMatcherFactory.js`) creates mode-specific matchers that validate whether current board content matches the expected format for that mode. Each matcher extends the abstract `PatternMatcher` base class (`src/types/PatternMatcher.js`).

**Key behavior**: Before each cron update, the controller validates the board against the current mode's pattern. If content doesn't match, it increments a mismatch counter. After 3 consecutive mismatches (configurable via `MISMATCH_THRESHOLD`), cron jobs stop and mode reverts to `MANUAL`. This prevents overwriting manually-set content while tolerating transient mismatches.

### Debug Mode

Toggle via `POST /api/debug/toggle`. When enabled, board writes print an ASCII grid to the console instead of calling the Vestaboard API. State persists in Redis. Useful for development without hardware.

### Weather Caching

Successful weather API responses are cached in Redis with a 6-hour TTL. If an API call fails, the cached data is used as a fallback. This prevents blank boards during API outages.

### Formatters

- `src/utils/weatherFormatter.js` — Normalizes verbose NWS descriptions to fit 14-char max (e.g., "Thunderstorms"→"Storm", "Scattered"→"Light")
- `src/utils/calendarFormatter.js` — Formats up to 5 events with color emoji, time, and truncated titles (14-char max)

### External Services

- **Vestaboard API** — Board read/write (`VESTABOARD_READ_WRITE_API_KEY`)
- **Upstash Redis** — State persistence across restarts
- **Google Calendar** — OAuth2 flow with token refresh
- **NWS + Visual Crossing** — Weather data (hardcoded to San Francisco: 37.7749, -122.4194)
- **Sunrise-Sunset API** — Sun times for day/night emoji selection

All external API calls have a 10-second timeout (`AbortSignal.timeout`).

### Redis Keys (`src/utils/redisClient.js`)

`CURRENT_MODE`, `DEBUG_MODE`, `GOOGLE_ACCESS_TOKEN`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_TOKEN_EXPIRY`, `WEATHER_CACHE:*`

## Deployment

Hosted on Railway at https://108space.com/. Redis via Upstash. Set `GOOGLE_REDIRECT_URI=https://108space.com/auth/google/callback` on Railway and in Google Cloud Console for calendar auth.
