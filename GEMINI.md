# Hadoop Ecosystem Simulator - GEMINI Context

## Project Overview
This project is an **interactive, browser-based Hadoop ecosystem simulator**. It visualizes how HDFS, YARN, and MapReduce cooperate to execute distributed jobs. The application runs as static HTML with JavaScript modules, utilizing React 18 and Babel Standalone (loaded via CDN) for the main UI components.

## Tech Stack
*   **Frontend:** HTML5, CSS, JavaScript (ES Modules).
*   **Framework:** React 18 (via CDN), Babel Standalone (for in-browser JSX compilation).
*   **Testing:**
    *   **E2E:** Playwright (`@playwright/test`).
    *   **Unit:** Node.js native test runner (`node --test`).
*   **Runtime:** Browser (Client-side logic), Python HTTP Server (for local development/serving).

## Architecture
The project follows a modular architecture where the core simulation logic is decoupled from the UI.

*   **Entry Points:** HTML files in the root directory (e.g., `index.html`, `hadoop-ecosystem-simulator.html`).
*   **Core Logic (`assets/js/hadoop-sim/`):**
    *   `index.js`: Main entry point exporting all modules.
    *   `simulation.js`: Orchestrates the overall simulation.
    *   `hdfs.js`: Simulates the Hadoop Distributed File System.
    *   `yarn.js`: Simulates Yet Another Resource Negotiator.
    *   `mapreduce.js`: Simulates MapReduce jobs.
    *   `events.js`: Event bus for communication.
    *   `state.js`: State management.
    *   `clock.js`, `random.js`, `config.js`: Utilities.
*   **UI Logic:** `assets/js/` contains specific scripts for different HTML pages (e.g., `hadoop-ecosystem-simulator.js`).

## Key Commands

### Development
To run the simulator locally, start a static file server:
```bash
python3 -m http.server 5173
# Access at http://localhost:5173/index.html
```

### Testing
**E2E Tests (Playwright):**
```bash
npm test
```
*   Configured in `playwright.config.js`.
*   Tests located in `tests/`.
*   Automatically starts the Python server if not running.

**Unit Tests (Node.js):**
```bash
npm run test:unit
```
*   Tests located in `tests/unit/`.

## Development Conventions
*   **Modules:** Uses standard ES Modules (`import`/`export`).
*   **Formatting:**
    *   2-space indentation.
    *   `camelCase` for functions and state variables.
    *   `PascalCase` for React components.
    *   `UPPER_SNAKE_CASE` for shared constants.
*   **React:**
    *   JSX is compiled in the browser via Babel Standalone.
    *   State is client-side, using React hooks.
*   **Formatting Tool:** Prettier (`npx prettier --write <file>`).

## Important Files
*   `README.md`: Main documentation and usage guide.
*   `package.json`: Dependencies and scripts.
*   `playwright.config.js`: Playwright configuration.
*   `assets/js/hadoop-sim/`: Core simulation library.
*   `AGENTS.md`: Contributor guidelines and deeper architectural details.
