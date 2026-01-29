# Water Sort Solver

A browser-based Water Sort puzzle solver with a simple UI to input a level and generate a step-by-step solution.

## Features
- Build bottles UI by choosing number of bottles + capacity
- Manual level input (top → bottom)
- Solver outputs:
  - move list (from → to)
  - optional state after every move
- Basic validation checks (capacity, helper empty bottles, color counts)

## How to run locally
### Option A: VS Code Live Server (recommended)
1. Open the folder in VS Code
2. Install the “Live Server” extension
3. Right click `index.html` → **Open with Live Server**

### Option B: Python local server
```bash
python -m http.server 8000
```
### Option C: Single file app
1. Open history folder
2. Download singlefile to your computer
3. Open in browser

### To Do List
1. Image to code
2. Dark mode
3. UI changes