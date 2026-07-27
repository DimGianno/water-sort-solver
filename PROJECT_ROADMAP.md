# Project Roadmap

## Current Status

- **Project maturity:** Portfolio-ready
- **Actively developed:** Yes
- **Last reviewed:** 2026-07-27

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

### Find a solution from an in-progress puzzle

- **Priority:** High
- **Status:** Planned
- **Value:** Lets users recreate their current bottle state and recover after becoming stuck partway through a level.
- **Scope:** Allow colors and empty spaces in any bottle, validate gapless partial states and total color counts, and remove the input-only assumption that the last two bottles remain empty.
- **Dependencies:** Generalize the builder and validation model; the existing solver already accepts partially filled bottles.
- **Complexity:** Medium
- **Portfolio relevance:** Demonstrates a flexible state model while preserving solver correctness and editable input.

### Import a puzzle from a screenshot

- **Priority:** High
- **Status:** Idea
- **Value:** Removes most manual setup and turns a captured game level directly into editable solver input.
- **Scope:** Accept a screenshot, detect bottle regions and layer colors, map results to the existing palette, and require confirmation before solving.
- **Dependencies:** The generalized in-progress puzzle model, a reliable client-side image-processing approach, and a representative screenshot fixture set
- **Complexity:** Large
- **Portfolio relevance:** Demonstrates computer-vision-assisted input, confidence handling, and human-in-the-loop correction.

### Share puzzles through URLs

- **Priority:** Low
- **Status:** Idea
- **Value:** Lets users share or bookmark a configured level without copying an export code manually.
- **Scope:** Encode a validated puzzle in the URL and restore it on page load with clear invalid-link handling.
- **Dependencies:** A compact URL-safe encoding and documented size limits
- **Complexity:** Medium
- **Portfolio relevance:** Demonstrates addressable application state and resilient client-side parsing.

## Suggested Next Milestones

1. **Reliable offline operation — Ready for review**
   - Goal: Keep puzzle entry and responsive solving available when connectivity disappears.
   - Included work: Install manifest, content-versioned application-shell cache, solver-worker precaching, update-safe cache cleanup, build-time asset checks, and visible offline readiness.
   - Completion criteria: A production browser can load once online, reload without network access, and complete a solver run in the cached worker.
2. **Recover from a stuck level — Planned**
   - Goal: Find a solution from the exact state of a level that is already in progress.
   - Included work: Editable partial bottles, color counting across every bottle, generalized validation, imports, and focused solver-flow coverage.
   - Completion criteria: Any structurally valid reachable state with the complete color inventory can be entered, corrected, and solved.
3. **Faster puzzle onboarding — In progress**
   - Goal: Reduce the time between opening Chromaflow and seeing a solution.
   - Included work: One-click curated sample completed; screenshot-assisted entry with editable recognition results remains planned.
   - Completion criteria: New visitors can run a sample immediately, and supported fresh or in-progress screenshots produce a reviewable puzzle state before solving.
