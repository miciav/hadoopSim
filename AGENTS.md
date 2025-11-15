# Repository Guidelines

## Project Structure & Module Organization
All logic lives in `hadoop-ecosystem-simulator.html`, which embeds React 18, ReactDOM, and Babel from CDNs. The `<script type="text/babel">` section defines the `HadoopEcosystem` component plus helper routines for cluster initialization, notifications, file management, and MapReduce job orchestration. If you split functionality, keep new modules beside this file and import them through additional `<script type="module">` tags so the simulator remains self-contained.

## Build, Test, and Development Commands
- `open hadoop-ecosystem-simulator.html` – launch the interactive simulator directly in Safari.
- `python3 -m http.server 5173` – serve the directory and visit `http://localhost:5173/hadoop-ecosystem-simulator.html` to mimic a static host (avoids CSP issues with inline Babel).
- `npx prettier --write hadoop-ecosystem-simulator.html` – reformat JSX/JS after substantial edits to keep two-space indentation intact.

## Coding Style & Naming Conventions
Use functional React components with hooks; rely on `const` and immutable updates (`setCluster(prev => ({ ...prev, ... }))`). Follow `camelCase` for functions/state variables, `PascalCase` for components, and `UPPER_SNAKE_CASE` for shared constants such as `REPLICATION_FACTOR`. UI labels and emojis already follow sentence case—mirror that tone. When adding complex allocation logic (e.g., rebalancing, replica placement), include concise comments describing invariants or tricky loops.

## Testing Guidelines
There is no automated test harness yet, so exercise the simulator manually in the browser. After every change validate: cluster bootstrap, file uploads of varying sizes, node failure + recovery, job submission, shuffle/reduce transitions, progress bars, and Gantt rendering. Keep DevTools console open to catch React warnings. For heavy business logic, extract pure helpers into separate scripts and cover them with ad-hoc tests via `node --test helper.spec.js`, but remove throwaway files before committing.

## Commit & Pull Request Guidelines
Write imperative commit subjects (“Hide map phase once Gantt renders”) and include body notes on UI behavior, resource accounting, and manual verification steps. Pull requests should summarize scope, list affected UI pieces, link issues, and attach before/after screenshots whenever the panel layout changes. Call out risks (e.g., scheduler fairness, notification timing) and highlight any new commands or configuration expectations for reviewers.

## Security & Configuration Tips
React/Babel CDN versions are pinned; update them deliberately and test on an HTTP server plus Safari/Chrome before merging. Keep everything client-side—avoid adding remote calls unless the project owner signs off. If you deploy publicly, prefer HTTPS hosting or a static-site service so browsers allow inline Babel compilation and notifications without mixed-content warnings.
