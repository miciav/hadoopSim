# Hadoop Ecosystem Simulator

An interactive, browser-based playground that visualizes how Hadoop HDFS, YARN, and MapReduce cooperate. The build produces a static site with locally bundled JavaScript and React.

## Features

- **Cluster dashboard** – See CPU, memory, and storage consumption across nodes, plus container allocations and per-block replica placement.
- **MapReduce orchestration** – Submit jobs per file and inspect mapper progress and data locality. The separate pipeline pages illustrate shuffle and reduce.
- **Failure & recovery drills** – Simulate node loss, observe re-replication, and inspect explicit job failure or mapper recovery.
- **Notifications + stats** – Inline toasts highlight successes and warnings, while summary cards show cluster usage.

## Quick Start

1. Clone or download the repo.
2. Use Node 24.22.1 (recorded in `.node-version`), then build and start a static server:
   ```bash
   npm ci
   npm run build
   npm run preview
   # then visit http://localhost:5173/index.html
   ```
3. Open a page through the preview server (examples):
   - `index.html` (landing page)
   - `hadoop-ecosystem-simulator.html`
   - `hadoop_full.html`
   - `hdfs_interactive.html`
   - `yarn_interactive.html`
   - `hadoop-map-side-pipeline-dual_nodes.html`

> Tip: After editing sources, rebuild and keep DevTools open for browser errors.

## Development Notes

- HTML entry points live in the repo root and load logic from `assets/js/` (shared library in `assets/js/hadoop-sim/`).
- The React simulator uses `assets/js/hadoop-ecosystem-simulator.js`; esbuild bundles JSX and dependencies into `dist/`.
- Formatting: two-space indentation, `const`/`let`, `camelCase` for functions/state, `PascalCase` for components, and `UPPER_SNAKE_CASE` for shared constants.
- Run `npm run format` to format maintained sources, tests, HTML and configuration.

## GitHub Pages

- GitHub Actions tests and builds the site, then publishes `dist/`.
- `index.html` is the landing page; all demos are linked from there.

## How It Works

- The build bundles React and JavaScript locally; GitHub Pages serves the static output.
- State runs in the browser and resets when the page is reloaded.
- Each page uses its own didactic level; see `docs/teaching-contracts.md`.

Formatting checks cover maintained source files. Generated output, dependencies and the npm-generated lockfile are excluded.

## Testing & Validation

Automated smoke tests are available via Playwright (not run by default).

```bash
npm ci
npx playwright install --with-deps chromium
npm run lint
npm run format:check
npm test
```

Core library unit tests:

```bash
npm run test:unit
```

After changes, manually verify:

1. Cluster initialization, file uploads across sizes, and proper replica distribution.
2. Node failure simulation, re-replication status messages and reset during execution.
3. MapReduce mapper allocation and progress, and the separate pipeline shuffle/reduce visualizations.
4. Console should remain free of React warnings/errors.

## Contributing

1. Fork + branch.
2. Make changes and keep commits imperative (e.g., “Improve mapper progress”).
3. Document new UI behavior, manual test steps, and add screenshots for visual tweaks.
4. Open a PR referencing related issues; reviewers focus on scheduler fairness, data locality, and state mutation safety.

See `AGENTS.md` for deeper contributor guidelines, coding conventions, and security notes.

The final implementation and verification record is in [docs/verification.md](docs/verification.md).
