# Project Architecture

This is a Node.js application that controls a Vestaboard display. The application serves as a bridge between different data sources (weather, calendar, etc.) and your Vestaboard display.

I host this app at [Railway](https://railway.com/), but any place you can have an only on Node.js server will work.

## System Overview

```mermaid
graph TD
    A[Web Interface] -->|HTTP Requests| B[Express Server]
    B --> C[Mode Controller]
    C -->|Updates| D[Board Service]
    D -->|Displays| E[Vestaboard]
    
    C -->|Requests| F[Weather Service]
    C -->|Requests| G[Calendar Service]
    
    H[Google Calendar API] -->|Data| G
    I[Weather API] -->|Data| F
```

## Core Components

### 1. Express Server (`src/app.js`)
The application's entry point that handles:
- Static file serving for the web interface
- RESTful API endpoints for board control
- OAuth2 flow for Google Calendar integration
- Environment validation and configuration
- Error handling and logging

### 2. Mode System (`src/types/Mode.js`)
The application supports multiple display modes:
- **MANUAL**: Direct control of the display through text input
- **CLOCK**: Shows current time in PST/PDT
- **WEATHER**: Displays 6-day weather forecast with temperature and conditions
- **CALENDAR**: Shows upcoming calendar events within a 7-day window

### 3. Services

#### Board Service (`src/services/boardService.js`)
- Manages communication with the Vestaboard API
- Handles character mapping and board formatting
- Supports debug mode with console visualization
- Provides real-time board content retrieval
- Implements message validation and error handling

#### Weather Service (`src/services/weatherService.js`)
- Integrates with National Weather Service API
- Provides detailed weather forecasts for specific coordinates
- Handles daytime/nighttime period filtering
- Includes precipitation probability and wind speed data
- Implements error handling and data validation

#### Calendar Service (`src/services/calendarService.js`)
- Full Google Calendar API integration
- Supports multiple calendar synchronization
- Filters all-day and declined events
- Handles timezone conversion (PST/PDT)
- Implements OAuth2 authentication flow
- Includes automatic token refresh mechanism

#### Token Service (`src/services/tokenService.js`)
- Manages Google OAuth tokens through environment variables
- Handles token validation and verification
- Supports automatic token refresh mechanism
- Provides token management functionality

### 4. Utilities
Located in `src/utils/`:
- **boardCharacters.js**: Manages Vestaboard character mapping
- **weatherFormatter.js**: Formats weather data for display
- **calendarFormatter.js**: Formats calendar events for display

## Web Interface
The application includes a web interface (`src/public/`) that provides:
- Real-time mode switching
- Current board status display
- OAuth2 authentication management
- Debug mode configuration
- Direct message input for manual mode

## Authentication
- Google Calendar integration uses OAuth2
- Authentication flow is handled through dedicated endpoints
- Tokens are securely stored and managed

## Configuration
- Environment variables are used for sensitive configuration
- Example configuration provided in `.env.example`
- Supports customizable port settings

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in required values
3. Install dependencies: `npm install`
4. Start the server: `npm start`
5. Access the web interface at `http://localhost:3000`

## Environment Variables Setup

To run this application, you need to set up several environment variables. Create a `.env` file in the root directory using `.env.example` as a template.

### Required Environment Variables:

1. **Vestaboard API Configuration**
   - `VESTABOARD_READ_WRITE_API_KEY`: Your Vestaboard read/write API key from [Vestaboard Developer Portal](https://www.vestaboard.com/developer)
   - `VESTABOARD_KEY`: Your Vestaboard application key
   - `VESTABOARD_SECRET`: Your Vestaboard application secret
   - `VESTABOARD_DEBUG`: Set to `true` for debug mode (optional)

2. **Google Calendar Integration**
   - `GOOGLE_CLIENT_ID`: OAuth 2.0 client ID from Google Cloud Console
   - `GOOGLE_CLIENT_SECRET`: OAuth 2.0 client secret from Google Cloud Console
   - `GOOGLE_REDIRECT_URI`: OAuth redirect URI (typically `http://localhost:3000/auth/google/callback` for local development)
   - `GOOGLE_ACCESS_TOKEN`: Current access token for Google Calendar API
   - `GOOGLE_REFRESH_TOKEN`: Refresh token for Google Calendar API
   - `GOOGLE_TOKEN_EXPIRY`: Expiry timestamp for the access token

3. **Debug Mode**
   - `NODE_DEBUG`: Set to `true` for additional debugging information (optional)

### How to Obtain the Credentials

1. **Vestaboard Credentials**:
   - Visit the [Vestaboard Developer Portal](https://www.vestaboard.com/developer)
   - Create a new application
   - Copy the provided API key, application key, and secret

2. **Google Calendar Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project
   - Enable the Google Calendar API
   - Configure the OAuth consent screen
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs
   - Complete the OAuth flow to obtain access and refresh tokens
   - Add the tokens to your `.env` file

## API Endpoints

- `GET /api/status`: Get current mode and debug status
- `POST /api/mode`: Change display mode
- `POST /api/debug/toggle`: Toggle debug mode
- `GET /auth/google`: Start Google OAuth flow
- `GET /auth/google/callback`: OAuth callback handler
- `GET /calendar/events`: Fetch calendar events
- `POST /auth/google/clear`: Clear calendar authentication

