# Repository Guidelines

## Project Structure & Module Organization
- HTML entry points live in the repository root:
  - `hadoop-ecosystem-simulator.html`
  - `hadoop_full.html`
  - `hdfs_interactive.html`
  - `yarn_interactive.html`
  - `hadoop-map-side-pipeline-dual_nodes.html`
- Page logic is in `assets/js/`; shared library lives under `assets/js/hadoop-sim/`.
- Page modules are bundled by esbuild; the React simulator keeps JSX in `assets/js/hadoop-ecosystem-simulator.js`.
- The generated `dist/` directory contains the static site and is published by GitHub Pages.
- If you split functionality further, keep new modules under `assets/js/` and import them with ES modules to keep pages static-host friendly.

## Build, Test, and Development Commands
- `npm run build` — build the static site into `dist/`.
- `npm run preview` — serve the built site at `http://localhost:5173/`.
- `npm run lint` and `npm run format:check` — run configured static checks.
- `npm run test:unit` — run Node unit tests for the core library.

## Coding Style & Naming Conventions
- Use functional React components with hooks and immutable updates, e.g. `setCluster(prev => ({ ...prev, ... }))`.
- Prefer `const` and avoid mutating shared state; keep helper logic pure when practical.
- Naming: `camelCase` for functions/variables, `PascalCase` for components, `UPPER_SNAKE_CASE` for shared constants (e.g., `REPLICATION_FACTOR`).
- UI labels and emojis are sentence case—match the existing tone.
- Add short comments only for complex allocation logic or tricky loops.

## Testing Guidelines
- Run Playwright smoke tests with `npm test` (installs via `npm install`, `npx playwright install --with-deps`).
- Validate manually in the browser after every change.
- Check: cluster bootstrap, file uploads (small/large), node failure + recovery, job submission, shuffle/reduce transitions, and progress bars.
- Keep DevTools console open for React warnings.

## Commit & Pull Request Guidelines
- Use imperative commit subjects (e.g., “Clarify mapper progress”).
- Commit bodies should note UI behavior changes, resource accounting impacts, and manual verification steps.
- PRs should summarize scope, list affected UI areas, link issues, and include before/after screenshots when layout changes.
- Call out risks such as scheduler fairness or notification timing, plus any new commands/config.

## Security & Configuration Tips
- Runtime dependencies are bundled locally and pinned in the lockfile; update deliberately and test via HTTP server in Safari/Chrome.
- Keep everything client-side; avoid remote calls unless explicitly approved.
- Prefer HTTPS hosting if deploying publicly to prevent mixed-content issues.
