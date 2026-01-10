# Hadoop Ecosystem Simulator

An interactive, browser-based playground that visualizes how Hadoop HDFS, YARN, and MapReduce cooperate. Everything runs as static HTML with JavaScript modules loaded from `assets/js`, plus React 18 + Babel (CDN) for the main ecosystem simulator.

## Features
- **Cluster dashboard** – See CPU, memory, and storage consumption across nodes, plus container allocations and per-block replica placement.
- **MapReduce orchestration** – Submit jobs per file, follow mapper / shuffle / reducer phases, and inspect data locality hints, shuffle fan-out, and completed timelines through a stylized Gantt chart.
- **Failure & recovery drills** – Simulate node loss, trigger re-replication, rebalance storage, or add/remove nodes to watch how the system adapts.
- **Notifications + stats** – Inline toasts highlight successes/warnings, while summary cards break down job durations, locality ratios, and reducer distribution.

## Quick Start
1. Clone or download the repo.
2. Start a static server:
   ```bash
   python3 -m http.server 5173
   # then visit http://localhost:5173/index.html
   ```
3. Open any page in the root (examples):
   - `index.html` (landing page)
   - `hadoop-ecosystem-simulator.html`
   - `hadoop_full.html`
   - `hdfs_interactive.html`
   - `yarn_interactive.html`
   - `hadoop-map-side-pipeline-dual_nodes.html`

> Tip: When editing JSX, keep DevTools open; Babel transpiles on the fly, so syntax errors are logged immediately.

## Development Notes
- HTML entry points live in the repo root and load logic from `assets/js/`.
- The React/Babel simulator uses `assets/js/hadoop-ecosystem-simulator.js` and compiles at runtime via Babel CDN.
- Formatting: two-space indentation, `const`/`let`, `camelCase` for functions/state, `PascalCase` for components, and `UPPER_SNAKE_CASE` for shared constants.
- Run `npx prettier --write hadoop-ecosystem-simulator.html` after large JSX edits.

## GitHub Pages
- The site is published via GitHub Actions from the repo root.
- `index.html` is the landing page; all demos are linked from there.

## How It Works (React + Babel)
- The HTML pulls React 18 UMD bundles and Babel Standalone from CDNs; Babel compiles the external script at load time directly in the browser.
- JSX/logic live in `assets/js/hadoop-ecosystem-simulator.js` and are mounted via `ReactDOM.createRoot`.
- State is fully client-side: hooks drive cluster/files/jobs, and persistence uses localStorage.

## Testing & Validation
There is no automated harness yet. After changes, manually verify:
1. Cluster initialization, file uploads across sizes, and proper replica distribution.
2. Node addition/removal, failure simulation, and re-replication status messages.
3. MapReduce lifecycle: mapper allocation, shuffle timing, reducer progress, and Gantt metrics.
4. Console should remain free of React warnings/errors.

## Contributing
1. Fork + branch.
2. Make changes and keep commits imperative (e.g., “Improve shuffle Gantt stats”).
3. Document new UI behavior, manual test steps, and add screenshots for visual tweaks.
4. Open a PR referencing related issues; reviewers focus on scheduler fairness, data locality, and state mutation safety.

See `AGENTS.md` for deeper contributor guidelines, coding conventions, and security notes.
