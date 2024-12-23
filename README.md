# Project Architecture

This project follows a modular architecture with clear separation of concerns. Here's an overview of how the components are organized:


```ascii
+------------------+
| app.js |
| (Entry Point) |
+--------+---------+
|
v
+------------------+ +-----------------+
| Routes |---->| Controllers |
| (modeRoutes.js) | | (modeController)|
+--------+---------+ +--------+--------+
|
v
+------------------+ +-----------------+
| Services | | Types |
| - boardService | | (Mode.js) |
| - weatherService | +-----------------+
| - calendarService|
+------------------+
├── apps/
│ └── clock/ # Clock application module
├── src/
│ ├── app.js # Main application entry point
│ ├── types/ # Type definitions
│ ├── controllers/ # Request handlers
│ ├── services/ # Business logic layer
│ └── routes/ # API route definitions
```

## Component Overview

### Core Components

1. **Entry Point (app.js)**
   - Initializes the application
   - Sets up middleware
   - Connects all routes

2. **Routes (src/routes/)**
   - `modeRoutes.js`: Defines API endpoints for mode operations
   - Handles request routing to appropriate controllers

3. **Controllers (src/controllers/)**
   - `modeController.js`: Handles mode-related business logic
   - Processes requests and coordinates with services

### Services

The application includes several service modules that handle specific functionality:

1. **Board Service (boardService.js)**
   - Manages board-related operations
   - Handles board state and configurations

2. **Weather Service (weatherService.js)**
   - Interfaces with weather APIs
   - Processes weather-related data

3. **Calendar Service (calendarService.js)**
   - Manages calendar integrations
   - Handles scheduling and event-related functionality

### Types

- `Mode.js`: Defines type definitions for different modes in the application

## Configuration Files

- `tsconfig.json`: TypeScript configuration
- `.env.example`: Template for environment variables
- `package.json`: Project dependencies and scripts

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and configure environment variables
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm start
   ```

## Development Guidelines

1. **Adding New Features**
   - Create appropriate service in `src/services/`
   - Add controller if needed in `src/controllers/`
   - Define routes in `src/routes/`
   - Update types as necessary

2. **Code Organization**
   - Keep services focused on specific functionality
   - Use controllers for request/response handling
   - Maintain clear separation of concerns

3. **Error Handling**
   - Implement proper error handling in services
   - Use consistent error response format in controllers

## API Documentation

Document your API endpoints here...
