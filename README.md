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

Install the development dependencies with Node.js 22.18 or newer, then start the Vite development server:

```bash
npm install
npm run dev
```

Then visit the local URL shown by Vite (normally `http://localhost:5173`). The application remains framework-free and has no production runtime dependencies.

## Test

Install the development dependencies and browser engines once:

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

Core tests use Vitest and run once through `npm test`. During development, use `npm run test:watch` to rerun affected tests as files change. Playwright remains responsible for end-to-end browser coverage.

Run the TypeScript compiler without emitting files:

```bash
npm run typecheck
```

Playwright starts and stops its dedicated test server automatically on `http://127.0.0.1:4174`.

GitHub Actions runs the complete test suite for every pushed branch and for pull requests.

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
assets/js/app.ts          Typed application state and event wiring
assets/js/app-types.ts    Shared application state and UI contracts
assets/js/builder.ts      Typed puzzle builder interactions
assets/js/solver.ts       Typed worker lifecycle and solution UI controller
assets/js/solver-core.ts  Typed A* search implementation
assets/js/solver-types.ts Shared puzzle, result, and worker message types
assets/js/solver-worker.ts Background search worker and typed message boundary
assets/js/replay.ts       Typed step-by-step solution replay
assets/js/io.ts           Typed puzzle import and export
assets/js/validation.ts   Typed input validation
assets/js/constants.ts    Typed capacity and color definitions
playwright.config.js      Browser projects and Vite test-server configuration
vitest.config.ts          Typed core-test configuration
scripts/build.mjs         Vite production and server-artifact build
tests/                    TypeScript core tests and Playwright browser tests
tsconfig.json             Application and core-test TypeScript checking
```

## Built with

Semantic HTML, modern CSS, and framework-free TypeScript modules bundled with Vite. Shared contracts cover application state, puzzle validation, import/export, replay, the A* search engine, and both sides of the Web Worker boundary. No production runtime dependencies are required; Vitest runs typed core tests and Playwright provides cross-browser end-to-end coverage.
