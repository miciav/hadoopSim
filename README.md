# Hadoop Ecosystem Simulator

An interactive, browser-based playground that visualizes how Hadoop HDFS, YARN, and MapReduce cooperate. Everything ships in a single HTML file backed by React 18 (via CDN) and Babel for live JSX compilation, so you can open it locally without an install step and watch nodes, blocks, and jobs evolve in real time.

## Features
- **Cluster dashboard** – See CPU, memory, and storage consumption across nodes, plus container allocations and per-block replica placement.
- **MapReduce orchestration** – Submit jobs per file, follow mapper / shuffle / reducer phases, and inspect data locality hints, shuffle fan-out, and completed timelines through a stylized Gantt chart.
- **Failure & recovery drills** – Simulate node loss, trigger re-replication, rebalance storage, or add/remove nodes to watch how the system adapts.
- **Notifications + stats** – Inline toasts highlight successes/warnings, while summary cards break down job durations, locality ratios, and reducer distribution.

## Quick Start
1. Clone or download the repo.
2. Open `hadoop-ecosystem-simulator.html` directly in a browser, or start a static server:
   ```bash
   python3 -m http.server 5173
   # then visit http://localhost:5173/hadoop-ecosystem-simulator.html
   ```
3. Use the sidebar controls to upload sample files, launch MapReduce jobs, and manage nodes.

> Tip: When editing JSX, keep DevTools open; Babel transpiles on the fly, so syntax errors are logged immediately.

## Development Notes
- Source + logic reside entirely in `hadoop-ecosystem-simulator.html` under a `<script type="text/babel">`. Hooks (`useState`, `useEffect`, `useCallback`) drive state updates.
- Formatting: two-space indentation, `const`/`let`, `camelCase` for functions/state, `PascalCase` for components, and `UPPER_SNAKE_CASE` for shared constants.
- Run `npx prettier --write hadoop-ecosystem-simulator.html` after large edits to keep JSX tidy.

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
