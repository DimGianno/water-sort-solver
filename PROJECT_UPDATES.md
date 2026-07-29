# Project Updates

## Latest Stable State

- **Last updated:** 2026-07-29
- **Current version:** 1.0.0
- **Current status:** Active
- **Primary branch:** `main`
- **Production URL:** https://chromaflow.dimgianno.com/
- **Staging URL:** Not deployed

## Current Project Summary

Chromaflow is a browser application for importing, recreating, and solving fresh or partially completed Water Sort puzzles. Users can recognize supported screenshots locally, configure levels with up to 14 bottles, correct colors through layer-first or color-first mobile workflows, validate the current bottle state, solve it with an A* search engine, and replay every move. The production application can be installed and caches its solver, screenshot recognizer, and interface for reliable offline use. The project uses semantic HTML, responsive CSS, and framework-free JavaScript and TypeScript modules bundled with Vite; Playwright is used for browser testing.

## Latest Updates

### 2026-07-29 - Compact saved-puzzle codec compatibility

- **Type:** Compatibility
- **Status:** Ready for review
- **Summary:** Updated the builder's saved-puzzle import and export flow to use the compact version-one binary payload within the existing `WS1:` Base64 wrapper.
- **User impact:** Newly exported codes interoperate with compact puzzle storage, pasting a valid compact puzzle restores every bottle and layer including empty helpers, and legacy saved-puzzle strings continue to import unchanged.
- **Technical impact:** Added reference-compatible nibble-packed exports, atomic header, bottle-count, byte-length, and color-code validation, top-to-bottom layer conversion, and focused unit and browser coverage through the existing import/export path.
- **Related area:** Puzzle import and builder compatibility

### 2026-07-28 - Clearer level configuration controls

- **Type:** User experience
- **Status:** Ready for review
- **Summary:** Replaced free-form bottle-count entry and visible color checkboxes with bounded, touch-friendly native controls.
- **User impact:** Bottle counts are selected from the valid 4–14 range using the device's familiar picker, while level colors appear as softly tinted tiles with clear selected, available, and unavailable states.
- **Technical impact:** Added a semantic native select, full-tile accessible checkbox targets, color-aware responsive styling, and cross-browser interaction and visual-regression coverage.
- **Related area:** Puzzle configuration and mobile input

### 2026-07-28 - More reliable A* move optimality

- **Type:** Correctness
- **Status:** Ready for review
- **Summary:** Corrected unsafe move pruning and strengthened the distinction between Fast and Optimal-ish search behavior.
- **User impact:** Equivalent-looking pours from meaningfully different source bottles are no longer discarded, and Optimal-ish can return shorter solutions that the previous heuristic missed.
- **Technical impact:** Made symmetric-move signatures source-aware, limited history-dependent reverse-pour pruning to Fast mode, replaced the Optimal-ish estimate with an admissible boundary-and-color-spread lower bound, and added regression coverage for the reported 14-bottle puzzle and its critical intermediate state.
- **Related area:** Solver correctness and search quality

### 2026-07-27 - Completed replay restart

- **Type:** Capability
- **Status:** Ready for review
- **Summary:** Added a dedicated restart control to completed solution replays.
- **User impact:** Users can restart playback from the beginning with one click after reaching the final solution step.
- **Technical impact:** Synchronized completed playback controls, reset replay state before resuming at the selected speed, reserved stable space for changing speed labels, and extended browser coverage for the restart and slider layout flows.
- **Related area:** Solution replay

### 2026-07-27 - MIT licensing

- **Type:** Project governance
- **Status:** Ready for review
- **Summary:** Added the MIT License and documented it in the project README.
- **User impact:** Users and contributors now have explicit permission to use, modify, and distribute Chromaflow under the license terms.
- **Technical impact:** Added the canonical MIT license text with the project copyright notice.
- **Related area:** Licensing and distribution

### 2026-07-27 - Offline screenshot puzzle import

- **Type:** Capability
- **Status:** Ready for review
- **Summary:** Added private, client-side recognition that converts supported Water Sort screenshots into editable Chromaflow puzzles.
- **User impact:** Users can select a fresh or in-progress screenshot, apply the detected bottles and colors, correct any layer in the existing builder, and solve without uploading the image or requiring an internet connection.
- **Technical impact:** Added resolution-independent bottle-outline detection, normalized four-layer sampling, calibrated color profiles, strict inventory and gap confidence checks, local image preview lifecycle handling, service-worker-compatible bundling, synthetic multi-resolution unit coverage, desktop/mobile browser coverage, and successful calibration against eight representative 11- and 14-bottle iPhone screenshots.
- **Related area:** Puzzle onboarding, offline capability, and image-assisted input

### 2026-07-27 - Solve from an in-progress puzzle

- **Type:** Capability
- **Status:** Ready for review
- **Summary:** Generalized puzzle entry and validation so fresh and partially solved levels use the same builder.
- **User impact:** Users who become stuck partway through a level can recreate the exact current bottle state, including colors in former helper bottles, and ask Chromaflow for a solution from there.
- **Technical impact:** Made every bottle editable, counted color inventory across the full state, accepted partial and empty bottles anywhere, added bottom-up gap validation, routed solver startup through raw-layout validation, preserved version-one import compatibility, and added typed core plus desktop/mobile browser coverage for a reachable mid-game solve.
- **Related area:** Puzzle entry, validation, and solver onboarding

### 2026-07-27 - Installable offline application

- **Type:** Capability
- **Status:** Ready for review
- **Summary:** Added versioned offline caching and an install manifest for the production application.
- **User impact:** After one connected visit reaches the Ready offline state, users can reload Chromaflow, recreate a puzzle, and run the responsive solver without an internet connection.
- **Technical impact:** Production builds now generate a content-versioned service worker that precaches the exact built page, styles, application entry point, solver worker, manifest, icon, and visual assets; old application caches are removed during activation, future builds fail if a required offline asset is missing, and the interface reports preparation, readiness, offline, update, unsupported, and failure states.
- **Related area:** Offline reliability and application delivery

### 2026-07-26 - Vite-native TypeScript unit tests

- **Type:** Quality
- **Status:** Completed
- **Summary:** Replaced the Node test runner with Vitest and migrated every core test file to TypeScript.
- **User impact:** Core behavior remains protected while contributors get faster Vite-native execution, watch mode, and compile-time checks for test fixtures.
- **Technical impact:** Added Vitest as a development dependency, migrated both core and Playwright test code to TypeScript, included every automated test in strict TypeScript checking, retained all 24 core assertion cases and 36 browser checks, and configured the quality workflow to run for every pushed branch and pull request.
- **Related area:** Testing and developer experience

### 2026-07-26 - Vite and TypeScript migration

- **Type:** Tooling
- **Status:** Completed
- **Summary:** Introduced Vite and migrated the browser application module by module to TypeScript.
- **User impact:** The puzzle-building, validation, background solving, cancellation, and replay behavior remains unchanged.
- **Technical impact:** Replaced the copy-based client build with Vite, added strict no-emit type-checking, migrated every application module, introduced shared application and solver contracts, and typed both sides of the Web Worker message boundary while retaining the existing server artifact.
- **Related area:** Developer experience and solver architecture

### 2026-07-26 - Stable cross-browser verification

- **Type:** Quality
- **Status:** Completed
- **Summary:** Stabilized browser-suite startup and refreshed verified Chromium visual baselines.
- **User impact:** Contributors can rely on a fully green browser matrix without mistaking restricted Firefox process failures or stale one-pixel snapshots for product regressions.
- **Technical impact:** Moved test-server ownership into Playwright on a dedicated port, preserved strict screenshot tolerances, and verified all 36 checks across desktop Chromium, desktop Firefox, mobile Chromium, and mobile WebKit.
- **Related area:** Testing and developer experience

### 2026-07-26 - One-click sample and faster puzzle rebuilding

- **Type:** Improvement
- **Status:** Completed
- **Summary:** Added a challenging one-click sample puzzle and a bulk clear action for the builder.
- **User impact:** First-time visitors can reach a real solution replay immediately, compare the Fast and Optimal-ish search tradeoff on a substantial level, and empty every editable bottle without rebuilding their configuration.
- **Technical impact:** Routed a verified 14-bottle sample through the existing import, validation, worker-solver, and replay flow; added comparative solver guarantees, replay reveal behavior, bulk inventory restoration, unchecked display-option defaults, and browser coverage.
- **Related area:** Onboarding and puzzle entry

### 2026-07-26 - Unified local quality and preview workflow

- **Type:** Tooling
- **Status:** Completed
- **Summary:** Added a single command that builds, tests, checks formatting, and previews the production bundle.
- **User impact:** Contributors can validate the project and open the built application through one consistent local workflow.
- **Technical impact:** Added Prettier as a development dependency, established a repository-wide formatting baseline, and extended the static server to preview `dist` without changing the Playwright source-server behavior.
- **Related area:** Developer experience

### 2026-07-26 - Responsive and cancelable solver execution

- **Type:** Performance
- **Status:** Completed
- **Summary:** Moved A* search into a Web Worker and added automatic clipboard export.
- **User impact:** Difficult searches no longer block the interface, live expanded-state progress remains visible, active searches can be cancelled, and exported puzzle codes are copied with accessible confirmation.
- **Technical impact:** Split the pure search engine from its UI controller, added a request-scoped worker protocol with progress and stale-result protection, implemented safe worker termination and mutation cancellation, and added clipboard fallback handling.
- **Related area:** Solver and sharing

### 2026-07-26 - Automated core and browser test suite

- **Type:** Quality
- **Status:** Completed
- **Summary:** Added automated core-logic and cross-browser product-flow coverage.
- **User impact:** Logic, interaction, and responsive-layout regressions are detected before changes reach the stable branch.
- **Technical impact:** Added core-logic coverage, now executed as typed Vitest tests, plus 36 Playwright checks across desktop Chromium, desktop Firefox, mobile Chromium, and mobile WebKit, with Chromium visual baselines and a GitHub Actions quality gate.
- **Related area:** Testing

### 2026-07-25 - Mobile-first dual-mode puzzle builder

- **Type:** Improvement
- **Status:** Completed
- **Summary:** Reworked puzzle entry around compact bottles and selectable layer-first or color-first fill workflows.
- **User impact:** Mobile users can enter levels one-handed, switch fill methods at any time, track the four available pieces of every color, and correct filled layers without exceeding puzzle limits.
- **Technical impact:** Added shared fill-mode state, a responsive color inventory, automatic layer advancement, color-first painting, counter restoration, exhausted-color removal, gapless bottle layers, and matching replay bottle geometry.
- **Related area:** User experience

### 2026-07-25 - Chromaflow portfolio redesign

- **Type:** Design
- **Status:** Completed
- **Summary:** Reframed the original solver as a polished responsive portfolio project with a distinctive visual identity.
- **User impact:** The full configure, build, solve, and replay workflow is clearer across light and dark themes.
- **Technical impact:** Added responsive page structure, accessible controls, social-preview metadata and artwork, production build support, and updated project documentation.
- **Related area:** Portfolio

## Current Capabilities

- Configure fresh or in-progress puzzles with 4 to 14 fully editable bottles.
- Select the exact number of colors required by the chosen bottle count.
- Enter bottle contents with layer-first automatic advancement or color-first painting.
- Load, solve, and reveal a curated sample puzzle with one action.
- Limit every selected color to four pieces with live remaining counters.
- Clear or replace layers while restoring the corresponding color inventory.
- Clear all editable bottles at once without changing the puzzle configuration.
- Validate bottle capacity, bottom-up layer continuity, selected colors, and complete color counts continuously.
- Solve puzzles with fast or optimal-ish A* search modes without blocking the interface.
- Track expanded-state progress and cancel an active search safely.
- Display concise moves or include the complete state after every move.
- Replay solutions step by step with adjustable playback speed.
- Import and export puzzle configurations using compact shareable codes with automatic clipboard copying.
- Install and reload the production application offline with the solver worker already cached.
- Support responsive light and dark themes without runtime dependencies.
- Verify core logic and browser workflows automatically across desktop and mobile profiles.

## Portfolio Highlights

- Incrementally typed, framework-free module architecture separating builder, validation, search, replay, and import/export responsibilities.
- Typed A* state-space search with heuristics, move ordering, deduplication, and redundant-move pruning.
- Responsive Web Worker execution with progress events, cancellation, and stale-result protection.
- Content-versioned offline delivery that keeps the application shell and solver worker on the same release.
- Mobile-first dual-mode puzzle entry with constrained color inventory and accessible native controls.
- Unified fresh and mid-game state entry backed by gap-aware validation across every bottle.
- Continuous validation that prevents invalid solver input and communicates completion state.
- Layered automated coverage for validation, import/export, solver behavior, browser interactions, and responsive layouts.
- Cross-browser GitHub Actions quality gate with retained failure traces and reports.
- Responsive visual replay that uses the same bottle model as puzzle entry.
- Vite production bundling with no client framework or production runtime dependencies.
