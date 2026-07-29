# Chromaflow

Chromaflow is a browser-based Water Sort puzzle solver that turns a manually recreated level into a step-by-step solution. It combines an interactive puzzle builder with an A* search engine and a visual replay experience.

**Live application:** [chromaflow.dimgianno.com](https://chromaflow.dimgianno.com/)

## Highlights

- Select 4–14 bottles with a bounded native picker and build levels with a fixed capacity of four layers
- Select a solvable known level from the MongoDB-backed online library and import it into the editable builder
- Try a challenging ready-made puzzle and compare the Fast and Optimal-ish solution tradeoff
- Choose between layer-first and color-first entry modes
- Recreate fresh levels or partially solved bottle states in the same editable builder
- Import supported Water Sort screenshots with private, offline recognition and review the detected layers before solving
- Track each color's four available pieces with live counters
- Clear one layer or every editable bottle while rebuilding a level
- Choose level colors from highlighted, tap-friendly tiles with live selection limits and input validation
- Solve with fast or optimal-ish A* search modes in a responsive Web Worker
- Follow expanded-state progress and cancel long searches safely
- Review a concise move list or include the full state after each move
- Replay solutions step by step with adjustable playback speed and restart a completed replay in one click
- Import and export puzzle configurations with a compact shareable code that copies automatically
- Reload and solve after losing connectivity once the production application reports that offline access is ready
- Install Chromaflow as a standalone application in browsers that support web app installation
- Switch between light and dark themes
- Use the complete experience on desktop, tablet, or mobile

## Run locally

Install the development dependencies with Node.js 22.18 or newer, then start the Vite development server:

```bash
npm install
npm run dev
```

Then visit the local URL shown by Vite (normally `http://localhost:5173`). The browser application remains framework-free. The known-level library requires the Vercel Function described below; when that endpoint is unavailable, manual setup, screenshots, and saved-code imports continue to work.

## Connect the known-level library

Chromaflow reads known levels through the same-origin `/api/levels` Vercel Function. The function connects to the `chromaflow` database and `levels` collection, returns only records marked `solvable: true`, and converts each generic MongoDB Binary puzzle into the existing `WS1:` import format. MongoDB credentials never enter the browser bundle.

Create a dedicated Atlas database user with read-only access to `chromaflow.levels`, then add its connection string to the Vercel project as a sensitive environment variable named `MONGODB_URI`. Configure it for the environments that need the library—normally Production and Preview—and redeploy after adding or changing the value. Atlas Network Access must also allow connections from the Vercel deployment.

For local end-to-end use, copy `.env.example` to the ignored `.env.local` file, add the development connection string, and run the project with `vercel dev`. The regular `npm run dev` workflow remains sufficient for browser-only development and testing.

## Use offline

Open the production application once while connected and wait for the **Ready offline** indicator. Chromaflow then saves the page, application code, styles, and solver worker on that device. You can reload the page, build a puzzle, and run the solver without an internet connection. Browsers that support web app installation can also install Chromaflow from their application menu.

Offline support requires HTTPS in production (or `localhost` during development). If the optional Google fonts are unavailable, the interface uses its built-in system-font fallbacks without affecting puzzle entry or solving.

## Import a screenshot

Choose **Import from a screenshot**, select a JPEG, PNG, or WebP image, and wait for Chromaflow to detect the bottle rows and liquid layers. Recognition runs entirely in the browser: the image is not uploaded and no internet connection is required once the application is ready offline.

The first recognition profile supports screenshots from Water Sort Puzzle on the [App Store](https://apps.apple.com/app/water-sort-puzzle/id1514542157) and [Google Play](https://play.google.com/store/apps/details?id=com.gma.water.sort.puzzle), based on its straight, light-outlined bottle style and the included calibrated iPhone screenshots. Chromaflow is an independent solver and is not affiliated with the game or its developer. Screen resolution may vary because bottle geometry is measured proportionally after the image is normalized. After applying the result, review every editable layer before solving. Screenshots from games with substantially different bottle artwork or liquid colors may still require manual entry.

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

Run type-aware ESLint and the TypeScript compiler without emitting files:

```bash
npm run lint
npm run typecheck
```

Playwright starts and stops its dedicated test server automatically on `http://127.0.0.1:4174`.

GitHub Actions runs the complete test suite for every pushed branch and for pull requests.

The suites cover fresh and in-progress puzzle validation, offline screenshot recognition at multiple resolutions, import/export handling, solver outcomes, sample onboarding, both fill modes, bulk clearing, replay controls, theme switching, and responsive desktop and mobile layouts. Browser tests run in Chromium, Firefox, and WebKit profiles.

Check repository formatting without changing files:

```bash
npm run format:check
```

Lint, build, run the core tests, check formatting, and then preview the production bundle:

```bash
npm run check
```

The preview remains available at `http://127.0.0.1:4173` until the command is stopped. To preview an existing build directly, run `npm run preview`.

## How it works

Puzzle states are encoded as ordered bottle contents. The known-level endpoint reads solvable MongoDB documents on the server, validates the version-one compact Binary shape, and returns browser-safe level numbers and `WS1:` codes. The selected code then follows the same import and validation path as a pasted saved puzzle. Validation accepts full, partial, and empty bottles anywhere in the level while requiring gapless liquid layers and exactly four pieces of every selected color. A module Web Worker runs the A* search with mode-specific heuristics, move scoring, state deduplication, and pruning for redundant pours. The worker reports expanded-state progress and can be terminated immediately without blocking the interface. Once a solution is found, every intermediate state is retained for the interactive replay.

## Project structure

```text
api/levels.ts           Read-only MongoDB level catalog Vercel Function
index.html              Interface and page structure
assets/css/styles.css   Responsive visual system and themes
assets/js/app.ts          Typed application state and event wiring
assets/js/app-types.ts    Shared application state and UI contracts
assets/js/builder.ts      Typed puzzle builder interactions
assets/js/levels.ts       Known-level catalog loading and import controller
assets/js/solver.ts       Typed worker lifecycle and solution UI controller
assets/js/solver-core.ts  Typed A* search implementation
assets/js/solver-types.ts Shared puzzle, result, and worker message types
assets/js/solver-worker.ts Background search worker and typed message boundary
assets/js/replay.ts       Typed step-by-step solution replay
assets/js/io.ts           Typed puzzle import and export
assets/js/offline.ts      Offline installation, readiness, and connectivity UI
assets/js/validation.ts   Typed input validation
assets/js/constants.ts    Typed capacity and color definitions
public/                   Web app manifest and install icon
eslint.config.js          Type-aware ESLint flat configuration for source and tests
playwright.config.ts      Typed browser projects and Vite test-server configuration
vitest.config.ts          Typed core-test configuration
scripts/build.mjs         Vite production and server-artifact build
tests/                    TypeScript core and Playwright browser tests
tsconfig.json             Application and core-test TypeScript checking
```

## Built with

Semantic HTML, modern CSS, and framework-free TypeScript modules bundled with Vite, plus a Node.js Vercel Function using the official MongoDB driver for read-only known-level access. Shared contracts cover application state, puzzle validation, level loading, import/export, replay, the A* search engine, and both sides of the Web Worker boundary. ESLint provides type-aware static analysis, Vitest runs typed core and API tests, and Playwright provides cross-browser end-to-end coverage.

## License

Chromaflow is available under the [MIT License](LICENSE).
