# Chromaflow

Chromaflow is a browser-based Water Sort puzzle solver that turns a manually recreated level into a step-by-step solution. It combines an interactive puzzle builder with an A* search engine and a visual replay experience.

## Highlights

- Build levels with 4–14 bottles and a fixed capacity of four layers
- Choose between layer-first and color-first entry modes
- Track each color's four available pieces with live counters
- Choose from a color palette with live input validation
- Solve with fast or optimal-ish A* search modes
- Review a concise move list or include the full state after each move
- Replay solutions step by step with adjustable playback speed
- Import and export puzzle configurations with a compact shareable code
- Switch between light and dark themes
- Use the complete experience on desktop, tablet, or mobile

## Run locally

Chromaflow is a dependency-free static web app. Serve the project folder with any local web server and open `index.html`.

For example, with Python:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## How it works

Puzzle states are encoded as ordered bottle contents. The solver uses A* search with mode-specific heuristics, move scoring, state deduplication, and pruning for redundant pours. Once a solution is found, every intermediate state is retained for the interactive replay.

## Project structure

```text
index.html              Interface and page structure
assets/css/styles.css   Responsive visual system and themes
assets/js/app.js        Application state and event wiring
assets/js/builder.js    Puzzle builder interactions
assets/js/solver.js     A* solver implementation
assets/js/replay.js     Step-by-step solution replay
assets/js/io.js         Puzzle import and export
assets/js/validation.js Input validation
assets/js/constants.js  Capacity and color definitions
```

## Built with

Semantic HTML, modern CSS, and vanilla JavaScript modules. No frameworks or runtime dependencies are required.
