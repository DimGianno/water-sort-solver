# Project Roadmap

## Current Status

- **Project maturity:** Portfolio-ready
- **Actively developed:** Yes
- **Last reviewed:** 2026-07-25

## Known Limitations

### Search runs on the browser's main thread

- **Area:** Performance
- **Severity:** High
- **User impact:** Difficult puzzles may temporarily make the interface feel unresponsive while the solver explores a large state space.
- **Technical impact:** A* search is synchronous and can expand up to the mode-specific state limit without yielding control to rendering or input handling.
- **Current workaround:** Use Fast mode first and reserve Optimal-ish mode for levels where a shorter solution matters.
- **Suggested resolution:** Move search into a Web Worker and stream progress updates back to the interface.
- **Status:** Known

### Puzzle entry is manual or code-based

- **Area:** Input
- **Severity:** Medium
- **User impact:** Users must recreate every bottle or import an existing Chromaflow code instead of capturing a game screenshot.
- **Technical impact:** The application has no image recognition, color sampling, or screenshot validation pipeline.
- **Current workaround:** Use either fill mode to enter the level manually, then export it for later reuse.
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

### Interactive browser coverage is not automated

- **Area:** Testing
- **Severity:** Medium
- **User impact:** Mobile layout or entry-flow regressions may not be detected by the current production build check.
- **Technical impact:** The repository validates JavaScript syntax, element wiring, and production output but has no automated browser interaction suite.
- **Current workaround:** Perform focused manual checks after builder or replay changes.
- **Suggested resolution:** Add browser tests for both fill modes, inventory limits, import/export, solving, replay, and representative mobile widths.
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
- **Status:** Idea
- **Value:** Lets first-time visitors experience solving and replay without manually entering a full level.
- **Scope:** Add a small curated sample selector that loads valid beginner, intermediate, and advanced puzzle states.
- **Dependencies:** Verified solvable examples and concise placement in the setup flow
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

### Move A* search into a Web Worker

- **Priority:** High
- **Reason:** Large synchronous searches can block rendering and input on mobile devices.
- **Expected outcome:** The interface stays responsive, progress remains visible, and long searches can be cancelled safely.
- **Affected area:** `assets/js/solver.js`, application state, solve controls, and worker messaging
- **Status:** Idea

### Add automated browser interaction tests

- **Priority:** High
- **Reason:** The dual-mode builder and responsive replay depend on interaction behavior that syntax and build checks cannot verify.
- **Expected outcome:** Repeatable coverage for counters, exhausted colors, clearing and replacing layers, both fill modes, import/export, replay controls, and mobile layouts.
- **Affected area:** Builder, replay, test fixtures, test configuration, and continuous integration
- **Status:** Idea

### Add a cancelable and bounded search experience

- **Priority:** Medium
- **Reason:** Search modes have fixed expansion ceilings but users cannot stop a search once it begins.
- **Expected outcome:** Users can cancel safely, understand current progress, and receive clearer guidance when the state limit is reached.
- **Affected area:** `assets/js/solver.js`, solve status, controls, and eventual worker integration
- **Status:** Idea

## Suggested Next Milestones

1. **Responsive search execution**
   - Goal: Keep Chromaflow interactive throughout difficult searches.
   - Included work: Web Worker extraction, progress events, cancellation, state-limit feedback, and solver regression tests.
   - Completion criteria: Search never blocks interface input, can be cancelled cleanly, and returns the same valid move sequences as the current implementation.

2. **Automated product-flow coverage**
   - Goal: Protect the complete mobile builder-to-replay experience from regressions.
   - Included work: Browser test setup, fill-mode and counter scenarios, import/export fixtures, solving, replay, and representative phone and desktop viewports.
   - Completion criteria: Both fill modes and the complete solve/replay journey pass reliably in the automated quality gate.

3. **Faster puzzle onboarding**
   - Goal: Reduce the time between opening Chromaflow and seeing a solution.
   - Included work: Curated samples followed by screenshot-assisted entry with editable recognition results.
   - Completion criteria: New visitors can run a sample immediately, and supported screenshots produce a reviewable puzzle state before solving.
