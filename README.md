# Chromaflow

Chromaflow is a browser-based Water Sort puzzle solver that turns a manually recreated level into a step-by-step solution. It combines an interactive puzzle builder with an A* search engine and a visual replay experience.

## Highlights

- Build levels with 4–14 bottles and a fixed capacity of four layers
- Try a challenging ready-made puzzle and compare the Fast and Optimal-ish solution tradeoff
- Choose between layer-first and color-first entry modes
- Track each color's four available pieces with live counters
- Clear one layer or every editable bottle while rebuilding a level
- Choose from a color palette with live input validation
- Solve with fast or optimal-ish A* search modes in a responsive Web Worker
- Follow expanded-state progress and cancel long searches safely
- Review a concise move list or include the full state after each move
- Replay solutions step by step with adjustable playback speed
- Import and export puzzle configurations with a compact shareable code that copies automatically
- Switch between light and dark themes
- Use the complete experience on desktop, tablet, or mobile

## Run locally

Chromaflow is a dependency-free static web app. Serve the project folder with any local web server and open `index.html`.

For example, with Python:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Test

Install the development dependency and browser engines once:

```bash
npm install
npx playwright install chromium firefox webkit
```

Run the core-logic tests, browser tests, or both:

```bash
npm test
npm run test:e2e
npm run test:all
```

The suites cover puzzle validation, import/export handling, solver outcomes, sample onboarding, both fill modes, bulk clearing, replay controls, theme switching, and responsive desktop and mobile layouts. Browser tests run in Chromium, Firefox, and WebKit profiles.

Check repository formatting without changing files:

```bash
npm run format:check
```

Build, run the core tests, check formatting, and then preview the production bundle:

```bash
npm run check
```

The preview remains available at `http://127.0.0.1:4173` until the command is stopped. To preview an existing build directly, run `npm run preview`.

## How it works

Puzzle states are encoded as ordered bottle contents. A module Web Worker runs the A* search with mode-specific heuristics, move scoring, state deduplication, and pruning for redundant pours. The worker reports expanded-state progress and can be terminated immediately without blocking the interface. Once a solution is found, every intermediate state is retained for the interactive replay.

## Project structure

```text
index.html              Interface and page structure
assets/css/styles.css   Responsive visual system and themes
assets/js/app.js        Application state and event wiring
assets/js/builder.js    Puzzle builder interactions
assets/js/solver.js     Worker lifecycle and solution UI controller
assets/js/solver-core.js Pure A* search implementation
assets/js/solver-worker.js Background search worker and message boundary
assets/js/replay.js     Step-by-step solution replay
assets/js/io.js         Puzzle import and export
assets/js/validation.js Input validation
assets/js/constants.js  Capacity and color definitions
playwright.config.js    Browser projects and visual-test configuration
scripts/serve.mjs       Local server for browser tests
tests/                  Core-logic and browser interaction tests
```

## Built with

Semantic HTML, modern CSS, and vanilla JavaScript modules. No frameworks or runtime dependencies are required; Playwright is used as a development-only browser testing tool.
