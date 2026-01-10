# Repository Guidelines

## Project Structure & Module Organization
- HTML entry points live in the repository root:
  - `hadoop-ecosystem-simulator.html`
  - `hadoop_full.html`
  - `hdfs_interactive.html`
  - `yarn_interactive.html`
  - `hadoop-map-side-pipeline-dual_nodes.html`
- Page logic is in `assets/js/`; shared helpers live under `assets/js/core/`.
- Static pages load ES modules via `<script type="module" src="./assets/js/...">`.
- The React/Babel simulator keeps JSX in `assets/js/hadoop-ecosystem-simulator.js` and compiles at runtime with the Babel CDN.
- If you split functionality further, keep new modules under `assets/js/` and import them with ES modules to keep pages static-host friendly.

## Build, Test, and Development Commands
- `open hadoop-ecosystem-simulator.html` — launch the simulator directly in Safari.
- `python3 -m http.server 5173` — serve the folder and open pages via `http://localhost:5173/...` to avoid CSP issues with inline Babel.
- `npx prettier --write hadoop-ecosystem-simulator.html` — reformat JSX/JS after sizable edits (two-space indentation).

## Coding Style & Naming Conventions
- Use functional React components with hooks and immutable updates, e.g. `setCluster(prev => ({ ...prev, ... }))`.
- Prefer `const` and avoid mutating shared state; keep helper logic pure when practical.
- Naming: `camelCase` for functions/variables, `PascalCase` for components, `UPPER_SNAKE_CASE` for shared constants (e.g., `REPLICATION_FACTOR`).
- UI labels and emojis are sentence case—match the existing tone.
- Add short comments only for complex allocation logic or tricky loops.

## Testing Guidelines
- Run Playwright smoke tests with `npm test` (installs via `npm install`, `npx playwright install --with-deps`).
- Validate manually in the browser after every change.
- Check: cluster bootstrap, file uploads (small/large), node failure + recovery, job submission, shuffle/reduce transitions, progress bars, and Gantt rendering.
- Keep DevTools console open for React warnings.

## Commit & Pull Request Guidelines
- Use imperative commit subjects (e.g., “Hide map phase once Gantt renders”).
- Commit bodies should note UI behavior changes, resource accounting impacts, and manual verification steps.
- PRs should summarize scope, list affected UI areas, link issues, and include before/after screenshots when layout changes.
- Call out risks such as scheduler fairness or notification timing, plus any new commands/config.

## Security & Configuration Tips
- CDN versions for React/Babel are pinned—update deliberately and test via HTTP server in Safari/Chrome.
- Keep everything client-side; avoid remote calls unless explicitly approved.
- Prefer HTTPS hosting if deploying publicly to prevent mixed-content issues.
