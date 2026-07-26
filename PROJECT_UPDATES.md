# Project Updates

## Latest Stable State

- **Last updated:** 2026-07-26
- **Current version:** 1.0.0
- **Current status:** Active
- **Primary branch:** `main`
- **Production URL:** Not deployed
- **Staging URL:** Not deployed

## Current Project Summary

Chromaflow is a dependency-free browser application for recreating and solving Water Sort puzzles. Users can configure levels with up to 14 bottles, enter colors through layer-first or color-first mobile workflows, validate the puzzle, solve it with an A* search engine, and replay every move. The project uses semantic HTML, responsive CSS, and modular vanilla JavaScript with no runtime framework or external package dependency.

## Latest Updates

### 2026-07-26 - Automated core-logic test suite

- **Type:** Quality
- **Status:** Completed
- **Summary:** Added dependency-free automated tests for validation, puzzle-code handling, and solver behavior.
- **User impact:** Core puzzle workflows can be changed with faster feedback when logic regressions are introduced.
- **Technical impact:** Added Node test-runner coverage for valid and invalid inputs, import/export round trips, malformed codes, solved states, and generated move sequences.
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

- Configure puzzles with 4 to 14 bottles and two reserved helper bottles.
- Select the exact number of colors required by the chosen bottle count.
- Enter bottle contents with layer-first automatic advancement or color-first painting.
- Limit every selected color to four pieces with live remaining counters.
- Clear or replace layers while restoring the corresponding color inventory.
- Validate bottle capacity, helper bottles, selected colors, and color counts continuously.
- Solve puzzles with fast or optimal-ish A* search modes.
- Display concise moves or include the complete state after every move.
- Replay solutions step by step with adjustable playback speed.
- Import and export puzzle configurations using compact shareable codes.
- Support responsive light and dark themes without runtime dependencies.

## Portfolio Highlights

- Modular vanilla JavaScript architecture separating builder, validation, search, replay, and import/export responsibilities.
- A* state-space search with heuristics, move ordering, deduplication, and redundant-move pruning.
- Mobile-first dual-mode puzzle entry with constrained color inventory and accessible native controls.
- Continuous validation that prevents invalid solver input and communicates completion state.
- Dependency-free automated coverage for validation, import/export, and solver behavior.
- Responsive visual replay that uses the same bottle model as puzzle entry.
- Dependency-free delivery with a small production build script and no client framework.
