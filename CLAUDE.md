# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server**: `npm run dev` (uses Nodemon for hot-reload)
- **Production**: `npm start` (runs `node src/app.js`)
- **Lint**: `npm run lint` (ESLint)
- No test framework is configured.

## Environment

- Node.js with ES Modules (`"type": "module"` in package.json)
- Express server on port 3000 (configurable via `PORT` env var)
- Copy `.env.example` to `.env` for required credentials
- Timezone is set to `America/Los_Angeles` — all cron schedules and time formatting assume PST/PDT

## Architecture

The app controls a [Vestaboard](https://www.vestaboard.com/) display through a mode-based system. A web interface (Vue 3 via CDN) lets users switch between display modes, and a cron scheduler keeps the board updated.

**Flow**: Web UI → Express API → ModeController → BoardService → Vestaboard API

### Key Files

- `src/app.js` — Express server, all API routes
- `src/controllers/modeController.js` — Core orchestration: mode switching, cron scheduling, content updates
- `src/services/boardService.js` — Vestaboard API client, character encoding, debug mode
- `src/services/weatherService.js` — Fetches from NWS, Visual Crossing, and Sunrise-Sunset APIs
- `src/services/calendarService.js` — Google Calendar OAuth2 integration
- `src/utils/redisClient.js` — Upstash Redis for persisting current mode and debug state
- `src/utils/boardCharacters.js` — Vestaboard character encoding map (codes 0-70) and pattern matching helpers
- `src/utils/cronSchedules.js` — Cron schedule definitions per mode
- `src/public/index.html` — Vue 3 single-page app (all frontend in one file)

### Display Modes (`src/types/Mode.js`)

`MANUAL`, `CLOCK`, `5DAYWEATHER`, `1DAYWEATHER`, `CALENDAR`, `TODAY` — each mode has a dedicated update function in modeController, a pattern matcher, and a cron schedule.

### Pattern Matching System

Factory pattern (`src/patterns/PatternMatcherFactory.js`) creates mode-specific matchers that validate whether current board content matches the expected format for that mode. This prevents auto-updates from overwriting manually-set content. Each matcher extends the abstract `PatternMatcher` base class (`src/types/PatternMatcher.js`).

### External Services

- **Vestaboard API** — Board read/write (`VESTABOARD_READ_WRITE_API_KEY`)
- **Upstash Redis** — State persistence across restarts
- **Google Calendar** — OAuth2 flow with token refresh
- **NWS + Visual Crossing** — Weather data
- **Sunrise-Sunset API** — Sun times for weather display

## Deployment

Hosted on Heroku. Redis via Upstash.
