# Project Roadmap

## Current Status

- **Project maturity:** Portfolio-ready
- **Actively developed:** Yes
- **Last reviewed:** 2026-07-26

## Known Limitations

### Personal puzzle entry is manual or code-based

- **Area:** Input
- **Severity:** Medium
- **User impact:** Users must recreate their own bottles or import an existing Chromaflow code instead of capturing a game screenshot; the ready-made sample only demonstrates the solve-and-replay flow.
- **Technical impact:** The application has no image recognition, color sampling, or screenshot validation pipeline.
- **Current workaround:** Try the curated sample for an immediate demo, or use either fill mode to enter a personal level manually and export it for later reuse.
- **Suggested resolution:** Add an optional screenshot-import flow with editable recognition results before building the solver state.
- **Status:** Known

### Puzzle rules use a fixed level model

- **Area:** Solver
- **Severity:** Low
- **User impact:** Variants with a capacity other than four or a different number of helper bottles cannot be represented.
- **Technical impact:** Capacity and validation rules assume four layers per bottle and exactly two empty helper bottles.
- **Current workaround:** Use Chromaflow with standard four-layer Water Sort levels.
- **Suggested resolution:** Make capacity and helper count configurable only if real target games require those variants.
- **Status:** Known

### Visual regression baselines are intentionally scoped

- **Area:** Testing
- **Severity:** Low
- **User impact:** Functional behavior is tested across Chromium, Firefox, and WebKit profiles, but subtle pixel-only differences outside the two Chromium baselines may still require visual review.
- **Technical impact:** Desktop and mobile Chromium have screenshot baselines; Firefox and mobile WebKit use interaction and layout assertions without pixel snapshots.
- **Current workaround:** Review Playwright traces, failure screenshots, and affected browser profiles when visual styles change.
- **Suggested resolution:** Add stable browser-specific baselines only when they provide enough regression value to justify their maintenance cost.
- **Status:** Known

## Next Features

### Import a puzzle from a screenshot

- **Priority:** High
- **Status:** Idea
- **Value:** Removes most manual setup and turns a captured game level directly into editable solver input.
- **Scope:** Accept a screenshot, detect bottle regions and layer colors, map results to the existing palette, and require confirmation before solving.
- **Dependencies:** A reliable client-side image-processing approach and a representative screenshot fixture set
- **Complexity:** Large
- **Portfolio relevance:** Demonstrates computer-vision-assisted input, confidence handling, and human-in-the-loop correction.

### Provide ready-to-try sample puzzles

- **Priority:** Medium
- **Status:** Completed
- **Value:** Lets first-time visitors experience solving and replay without manually entering a full level.
- **Scope:** Add a curated sample action that loads a challenging puzzle, runs the real solver, and reveals replay automatically.
- **Dependencies:** Completed with a verified 14-bottle example that demonstrates the Fast versus Optimal-ish tradeoff
- **Complexity:** Small
- **Portfolio relevance:** Improves product onboarding and makes the solver immediately demonstrable to portfolio reviewers.

### Share puzzles through URLs

- **Priority:** Low
- **Status:** Idea
- **Value:** Lets users share or bookmark a configured level without copying an export code manually.
- **Scope:** Encode a validated puzzle in the URL and restore it on page load with clear invalid-link handling.
- **Dependencies:** A compact URL-safe encoding and documented size limits
- **Complexity:** Medium
- **Portfolio relevance:** Demonstrates addressable application state and resilient client-side parsing.

## Technical Improvements

### Migrate frontend modules incrementally to TypeScript

- **Priority:** Medium
- **Reason:** Shared puzzle structures and asynchronous worker messages benefit from compile-time contracts without requiring a framework rewrite.
- **Expected outcome:** Complete the migration module by module while preserving browser behavior and keeping each review focused.
- **Affected area:** Build tooling, constants, validation, solver modules, worker messaging, and tests
- **Status:** Completed - Vite now bundles a fully TypeScript application, with shared contracts covering state, validation, builder, import/export, replay, solver logic, and worker messaging; all core tests are also TypeScript and run through Vitest.

### Move A* search into a Web Worker

- **Priority:** High
- **Reason:** Large synchronous searches can block rendering and input on mobile devices.
- **Expected outcome:** Achieved with a responsive interface, expanded-state progress, immediate cancellation, automatic mutation cancellation, and stale-result protection.
- **Affected area:** Solver core, worker messaging, application state, and solve controls
- **Status:** Completed

### Maintain automated browser interaction tests

- **Priority:** High
- **Reason:** The dual-mode builder and responsive replay depend on interaction behavior that core-logic tests cannot verify.
- **Expected outcome:** Achieved with 36 passing checks for counters, exhausted colors, clearing layers, both fill modes, import/export, solving, replay controls, themes, overflow, and representative mobile layouts, plus Playwright-managed test-server startup.
- **Affected area:** Builder, replay, test fixtures, Playwright configuration, visual baselines, and continuous integration
- **Status:** Completed

### Add a cancelable and bounded search experience

- **Priority:** Medium
- **Reason:** Search modes have fixed expansion ceilings but users cannot stop a search once it begins.
- **Expected outcome:** Achieved with a Solve/Cancel control, live expanded-state status, existing mode-specific limits, and clear completion or failure feedback.
- **Affected area:** Solver controller, solve status, and controls
- **Status:** Completed

## Suggested Next Milestones

1. **Responsive search execution — Completed 2026-07-26**
   - Goal: Keep Chromaflow interactive throughout difficult searches.
   - Included work: Web Worker extraction, progress events, cancellation, state-limit feedback, and solver regression tests.
   - Completion criteria: Search never blocks interface input, can be cancelled cleanly, and returns the same valid move sequences as the current implementation.

2. **Automated product-flow coverage — Completed 2026-07-26**
   - Goal: Protect the complete mobile builder-to-replay experience from regressions.
   - Included work: Browser test setup, fill-mode and counter scenarios, import/export fixtures, solving, replay, and representative phone and desktop viewports.
   - Completion criteria: Both fill modes and the complete solve/replay journey pass reliably in the automated quality gate.

3. **Faster puzzle onboarding — In progress**
   - Goal: Reduce the time between opening Chromaflow and seeing a solution.
   - Included work: One-click curated sample completed; screenshot-assisted entry with editable recognition results remains planned.
   - Completion criteria: New visitors can run a sample immediately, and supported screenshots produce a reviewable puzzle state before solving.
