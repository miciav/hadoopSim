# Private lecture redesign

Build from upstream ff0faca984a1984e8291a74217037308824de83c. Keep all original entry points, engines, IDs, local dependencies, transitions and animations. Deploy only the separate owner-private Site.

Implementation plan:

1. Add a shared lecture shell and local SVG symbols. Default this private evaluation to Lecture. Rebuild the catalog around six existing simulators.
2. Recompose teaching controls into a docked rail and add a phase overview. Phase view shows the current phase's original DOM; full view retains the complete original diagram. On 4:3 move the guide below the canvas. Never shrink the diagram text to fit.
3. Add keyboard/click inspection with a named focus outline, explanation and Continue action. Add an optional pause gate to the existing pipeline animation wait utility so in-flight transfers pause and resume without reset. Reset releases pending work. Other cluster diagrams support selection without altering their simulation state.
4. Validate pause/resume/reset with a small Node check; run core unit tests and production build. Use the browser for all interactive QA: teaching map/spill/combine/shuffle/reduce/output, reset, layouts, HDFS upload/failure, YARN scheduling and full-cluster jobs. Check browser errors and bounds. Save and deploy exact source privately.

Design decisions: preserve the existing client-side implementation rather than replacing engines; sober engineering iconography; 18px body text, 16px minimum diagram labels; manual focus outlined in navy, active execution in amber. Keep original detailed content available, including local scrolling for large data.

Verification record (10 November 2026):

- Production build and 149 Node checks pass, including two new pause/abort checks.
- Browser: initial input, automatic playback to 16/16, expected counts ant=7, arm=2, car=5, cat=1, cup=3, day=3, dog=2, dot=1; focus holds the counter and records; Continue resumes; reset while held clears overlays and restores controls. Current-phase and full-pipeline views work.
- Browser: explicit 4:3 layout uses a 1024px container; narrow canvas stacks mapper nodes. Main stage uses local scrolling for detailed records rather than reducing type size. Controls remain in a fixed bottom bar.
- Browser: HDFS small/large uploads, keyboard selection retained across render, failure and re-replication, reset. YARN allocation and saturation queue (8 waiting containers observed, CPU and RAM below capacity), reset. Full-cluster upload, mapper progress, data locality and completion. React ecosystem upload, job and node failure recovery. Continuous pipeline deploy and reset checked.
- Existing mathematical models and scheduling policies are unchanged. Pipeline waits now support an optional presentation pause. No writes were made to the original GitHub repository or its Pages deployment.
