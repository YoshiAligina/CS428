# City Traffic Board Game

A browser-based traffic board game with optional simulation tooling for difficulty/balance checks.

## Requirements

- Windows 10/11
- A modern browser (Chrome or Edge recommended)
- Internet connection (the app loads Three.js from CDN)
- Optional: Node.js 18+ to run batch simulations

## Run the Game

### Option A: Quick launch (no server)

1. Open the project folder:
   - `C:\Users\yoshi\Desktop\yoshiaiplaying\CS428\2`
2. Double-click `index.html`.
3. The game opens in your default browser.

### Option B: Recommended launch (local server)

1. Open PowerShell in the project folder.
2. Run:
   - `cd C:\Users\yoshi\Desktop\yoshiaiplaying\CS428\2`
   - `py -m http.server 8000`
3. Open:
   - `http://localhost:8000`
4. Stop server with `Ctrl + C` in PowerShell.

## Run the Simulation Script

The simulation runs multiple games and reports completion rate + difficulty recommendation.

1. Open PowerShell in the project folder.
2. Run:
   - `cd C:\Users\yoshi\Desktop\yoshiaiplaying\CS428\2`
   - `node scripts\simulateGames.js`
3. Expected output includes:
   - Number of games simulated
   - Agents completed / total agents
   - Success percentage
   - Recommendation (too hard / too easy / in target range)

## Basic In-Game Controls

- **End Turn**: Advance one turn
- **Start**: Enable autoplay
- **Arrow buttons**: Move current player
- **Place Roadblock**: Use special ability when available

## Troubleshooting

- **Blank page or missing visuals**: Refresh once and confirm internet access.
- **`py` not found**: Install Python 3, then reopen PowerShell.
- **`node` not found**: Install Node.js LTS, then reopen PowerShell.
- **Port 8000 already in use**: Run `py -m http.server 8080` and open `http://localhost:8080`.

## Project Structure (key files)

- `index.html` — browser entry point
- `styles.css` — game UI styles
- `src/` — game logic and rendering code
- `scripts/simulateGames.js` — batch simulation runner
