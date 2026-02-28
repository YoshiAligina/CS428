# Debug Mode - Developer Quick Start

## First Time Setup

### Enable Debug Mode
1. Start the game by opening `index.html` in your browser
2. Press **D** to enable debug mode
3. You should see an FPS counter in the top-left corner (green text)

## Most Useful Combinations

### For General Development (Start Here)
```
Press: D + P + L
You'll see:
- FPS counter (top-left)
- Agent colored path lines
- Grid coordinates on tiles
```

### For Pathfinding Debugging
```
Press: D + P + X
Then: Open browser console (F12)
You'll see:
- Agent paths visually
- Detailed pathfinding logs in console
- Path success/failure reasons
```

### For Traffic/Congestion Analysis
```
Press: D + P + C
You'll see:
- FPS counter
- Agent paths
- Congestion numbers on busy tiles (green→red)
```

### For Map Layout Understanding
```
Press: D + L
Then: Move mouse around the board
You'll see:
- Tile coordinates
- Hover shows exact position
- Grid structure clearly visible
```

## Quick Debugging Workflow

### Agent Not Moving?
1. Press **D + P** to see if a path exists
2. If no colored line appears, the agent has no path
3. Press **X** and check console for pathfinding error
4. Common issues:
   - Goal tile blocked
   - Goal not walkable (BUILDING)
   - Path completely surrounded by obstacles

### Agent Stuck in Place?
1. Press **D + C** to see congestion
2. Is the agent's tile red/high congestion? → Wait, it's congested
3. Press **D + L** to check coordinates
4. Press **D + G** (sparingly) to verify tile is connected
5. If disconnected, board generation issue

### Pathfinding Returning No Path?
1. Open browser console (F12)
2. Press **D + X** and trigger pathfinding (end turn)
3. Look for console messages:
   ```
   [Pathfinding] Starting pathfinding from (x,y) to (x,y)
   [Pathfinding] No path found after N iterations
   ```
4. Check if start/goal positions are valid

### Performance Issues?
1. Keep **D** only (just FPS counter)
2. Note the FPS baseline
3. Enable features one at a time (P, then L, then C, then G)
4. Watch FPS drop with each feature
5. Graph (G) has highest impact - keep disabled in production
6. Report baseline and impacts for optimization

## Keyboard Shortcuts Cheat Sheet

```
D - Main toggle (enables FPS counter)
P - Path lines (each agent different color)
L - Tile labels (grid coordinates)
C - Congestion display (traffic levels)
G - Graph edges (tile connections)
X - Pathfinding logs (console output)
```

## Browser Console Tips

### View Pathfinding Logs
```javascript
// Open F12, go to Console tab
// You'll see messages like:
[Pathfinding] Starting pathfinding from (3,5) to (12,10)
[Pathfinding] Path found with 15 steps
```

### Access Debug Objects
```javascript
// In console, you can directly access:
window.gameDebugMode       // Debug mode instance
window.gameRenderer        // 3D renderer
window.gameInputManager    // Input handler

// Get specific tile information:
window.gameDebugMode.getTileDebugInfo(5, 7)
// Returns object with type, walkable, congestion, neighbors, etc.
```

### Toggle Debug Features Programmatically
```javascript
// In console:
window.gameDebugMode.showPaths = true
window.gameDebugMode.logPathfinding = true
window.gameDebugMode.render()  // Force update
```

## Visual Indicators Guide

### Path Lines
- **Red** = Agent 0
- **Green** = Agent 1
- **Blue** = Agent 2
- **Yellow** = Agent 3
- Line thickness = 2 pixels
- Semi-transparent so you can see through them

### Congestion Numbers
- **Green (0-1)** = Light traffic
- **Yellow (2-3)** = Moderate traffic
- **Red (4-5)** = Heavy congestion
- Number shows exact congestion level
- Only appears on tiles with traffic

### Graph Visualization
- **Blue lines** = Walkable connections
- **Semi-transparent** = See buildings underneath
- **High density** = Many interconnected paths
- Performance tip: Disable if FPS drops significantly

### FPS Counter
- **Green box** in top-left corner
- Shows real-time frames per second
- Updates every 1 second
- Target: 60 FPS for smooth gameplay

## Common Debug Sessions

### Session 1: First Look at Game
```
1. Start game
2. Press D (enable debug)
3. Press L (see coordinates)
4. Press P (see paths)
5. Click End Turn
6. Watch agents move with colored paths
7. Move mouse to see tile names
```

### Session 2: Check Pathfinding
```
1. Press D + P + X
2. Open Console (F12)
3. Click End Turn
4. Watch console for pathfinding messages
5. Look for errors like "Goal tile not walkable"
6. Fix issues in code
7. Reload and test again
```

### Session 3: Performance Check
```
1. Press D (only, rest disabled)
2. Note FPS baseline
3. Press P, check FPS
4. Press L, check FPS
5. Press C, check FPS
6. Press G, check FPS
7. Document: "Baseline: 60, +P: 59, +L: 57, +C: 56, +G: 45"
```

### Session 4: Traffic Analysis
```
1. Press D + C
2. Play several turns
3. Watch congestion numbers increase
4. Identify bottlenecks (high congestion tiles)
5. Observe agent movement patterns
6. Consider map improvements for better flow
```

## Tips & Tricks

### Tip 1: Coordinate Lookup
Need to know a tile's position?
1. Enable L (labels)
2. Move mouse to tile
3. Read coordinates directly on screen
4. Or use inspector and read position

### Tip 2: Path Validation
Want to verify pathfinding works?
1. Enable P (paths)
2. Check if agent has colored line
3. If no line = no valid path = bug

### Tip 3: Performance Profiling
Compare with/without debug:
1. Disable all debug (press D)
2. Measure game loop time
3. Enable different visualizations
4. Measure again
5. Calculate overhead

### Tip 4: Console Investigation
Deep dive into specific issues:
```javascript
// Get detailed tile info
const info = window.gameDebugMode.getTileDebugInfo(x, y);
console.table(info);

// Check all agents
window.game.agents.forEach(a => {
    console.log(`Agent ${a.id}: (${a.x},${a.y}) path length: ${a.path.length}`);
});
```

## Troubleshooting

### Debug Mode Won't Turn On
- Reload page (Ctrl+R)
- Check browser console for errors (F12)
- Ensure DebugMode.js is loaded (check Network tab)
- Try pressing D again

### Visualizations Not Showing
- Press D first (enable debug)
- Then press the feature key (P, L, C, G, X)
- Check FPS counter - if present, debug is on
- Try pressing the key again to toggle
- Check console for JavaScript errors

### Pathfinding Logs Don't Appear
- Press D + X to enable logging
- Open console (F12) first
- Click "End Turn" to trigger pathfinding
- Look for "[Pathfinding]" prefix messages
- Scroll console history

### FPS Counter Moves or Disappears
- It's positioned in top-left corner
- Should stay visible while debug enabled
- If missing, reload page
- Check if browser dev tools overlap it

## Advanced Usage

### Custom Debug Logging
```javascript
// In your code, you can add custom debug logs:
if (window.gameDebugMode && window.gameDebugMode.enabled) {
    console.log('Custom debug message');
}
```

### Modify Debug Settings at Runtime
```javascript
// Adjust visualization sampling (in console):
const debug = window.gameDebugMode;
// Current sample rate is 2 (every 2nd tile)
// To change: edit visualizeCoordinates() method

// Force clean all visualizations:
debug.clear();
debug.render();
```

### Monitor Agent Activity
```javascript
// In console, watch specific agent:
setInterval(() => {
    const agent = window.game.agents[0];
    console.log(`Agent 0: (${agent.x},${agent.y}), status: ${agent.status}, path: ${agent.path.length}`);
}, 1000);
```

## Best Practices

1. **Start Simple**: D + P is your baseline
2. **Add Features**: Don't enable everything at once
3. **Monitor FPS**: Watch impact of each feature
4. **Use Console**: F12 is your friend for detailed info
5. **Reload Often**: When testing changes, hard-reload (Ctrl+Shift+R)
6. **Clean Debug**: Remove console.log from production code
7. **Document Issues**: Note what each visualization showed

## When to Use Each Feature

| Feature | When to Use |
|---------|------------|
| **D** | Always (see FPS, baseline) |
| **P** | Debugging movement, pathfinding |
| **L** | Understanding grid, coordinates |
| **C** | Analyzing traffic, bottlenecks |
| **G** | Verifying map connectivity |
| **X** | Investigating pathfinding bugs |

## Next Steps

1. **Explore**: Try each key combination and see what they show
2. **Experiment**: Change code and see debug visualizations update
3. **Document**: Note what you learn about the game
4. **Optimize**: Use performance data to improve game systems
5. **Share**: Help other developers learn the debug mode

---

**Remember**: The debug mode is your window into how the game systems work. Use it to understand, verify, and optimize!
