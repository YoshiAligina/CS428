# Debug Mode Documentation

Debug mode is a comprehensive development visualization system that helps verify game systems are working correctly.

## Activating Debug Mode

Press **D** to toggle debug mode on/off. When enabled, you'll see an FPS counter in the top-left corner.

## Debug Features

### FPS Counter
- **Location**: Top-left corner
- **Shows**: Real-time frames per second
- **Purpose**: Monitor rendering performance and identify frame rate issues

### Agent Path Visualization
- **Toggle**: Press **P** (while debug mode is active)
- **Shows**: Colored lines connecting agent current position to goal
- **Colors**: Each agent gets a unique color (red, green, blue, yellow, magenta, cyan)
- **Purpose**: Verify pathfinding algorithms are working and visualize route planning

### Tile Coordinates
- **Toggle**: Press **L** (while debug mode is active)
- **Shows**: Grid coordinates (x,y) displayed on every other tile
- **Purpose**: Understand grid layout and verify tile positions

### Congestion Display
- **Toggle**: Press **C** (while debug mode is active)
- **Shows**: Congestion values as numbers on tiles with high traffic
- **Colors**: Green (low) → Red (high congestion)
- **Range**: 0-5 congestion levels
- **Purpose**: Monitor traffic congestion and identify bottleneck tiles

### Graph Visualization
- **Toggle**: Press **G** (while debug mode is active)
- **Shows**: Blue lines connecting walkable tiles in the navigation graph
- **Purpose**: Verify board graph connectivity and ensure agents have valid paths

### Pathfinding Logging
- **Toggle**: Press **X** (while debug mode is active)
- **Shows**: Console messages for pathfinding decisions
- **Includes**:
  - Path start/goal positions
  - Path length when found
  - Iteration counts for A* algorithm
  - Failure reasons if no path found
- **Purpose**: Debug pathfinding issues and understand algorithm behavior

## Console Integration

Open browser DevTools (F12) to see detailed console logging:

```
[Pathfinding] Starting pathfinding from (x,y) to (x,y)
[Pathfinding] Path found with N steps
[Pathfinding] No path found after M iterations
```

## Debug Keyboard Shortcuts

| Key | Function |
|-----|----------|
| **D** | Toggle debug mode on/off |
| **P** | Toggle path visualization (debug mode only) |
| **L** | Toggle coordinate labels (debug mode only) |
| **C** | Toggle congestion display (debug mode only) |
| **G** | Toggle graph visualization (debug mode only) |
| **X** | Toggle pathfinding logging (debug mode only) |

## Using Debug Mode for Testing

### Verify Pathfinding
1. Press **D** to enable debug mode
2. Press **P** to show agent paths
3. Click on agents to select them and watch their planned routes
4. Press **X** to enable pathfinding logging and see algorithm details

### Check Congestion Flow
1. Enable debug mode with **D**
2. Press **C** to show congestion values
3. Play game turns and observe traffic building up
4. Identify bottleneck areas where agents get stuck

### Understand Map Layout
1. Press **D** and **L** to show coordinates
2. Use mouse to hover over tiles and see exact positions
3. Compare visual layout with coordinate system
4. Press **G** to see walkable tile connections

### Monitor Performance
1. Keep FPS counter visible (debug mode enabled)
2. Watch how FPS changes during gameplay
3. Identify frame drops that indicate performance issues
4. Compare FPS with/without visualizations enabled

## Accessing Debug Programmatically

In the browser console, you can directly access the debug mode:

```javascript
// Access the global debug mode instance
const debug = window.gameDebugMode;

// Toggle specific visualizations
debug.showPaths = false;
debug.showLabels = true;

// Get tile information at specific location
const info = debug.getTileDebugInfo(5, 7);
console.log(info); // Shows tile data, congestion, blockage, neighbors, etc.

// Enable pathfinding logging
debug.logPathfinding = true;

// Log a custom debug message
debug.logPathfindingDecision({
    agent: agentObject,
    decision: "Path blocked",
    details: { x: 5, y: 7, reason: "accident" }
});
```

## Performance Considerations

Debug visualizations can impact performance on slower systems:

- **Path lines**: Minimal impact (4 lines max)
- **Coordinate labels**: Moderate impact (64 labels for 16x16 grid)
- **Congestion display**: Moderate impact (shows only non-zero values)
- **Graph visualization**: High impact (many lines for full connectivity)

**Recommendation**: Keep only needed visualizations enabled during testing.

## Troubleshooting

### Debug Mode Won't Activate
- Ensure game is fully loaded
- Check that DebugMode.js is loaded in index.html
- Open browser console (F12) and check for errors

### Visualizations Not Showing
- Verify debug mode is enabled (check FPS counter)
- Verify the specific visualization is toggled on (press the key again)
- Check browser console for rendering errors
- Ensure agents/board are properly initialized

### Pathfinding Logging Shows Nothing
- Press **X** to enable logging
- Click "End Turn" to trigger pathfinding
- Open browser console to see messages
- Check console filter isn't hiding log messages

### Performance Issues
- Disable graph visualization (**G** key)
- Disable coordinate labels (**L** key)
- Keep FPS counter visible to monitor impact
- Test individual features one at a time

## Debug Mode Implementation Details

### File: src/DebugMode.js
- **Class**: DebugMode
- **Purpose**: Central debug visualization and logging system
- **Methods**:
  - `toggle()` - Toggle debug mode
  - `visualizePaths()` - Render agent path lines
  - `visualizeCoordinates()` - Show tile coordinates
  - `visualizeCongestion()` - Display congestion values
  - `visualizeGraph()` - Show board graph connections
  - `getTileDebugInfo(x, y)` - Get tile debug data
  - `handleKeyPress(key)` - Process keyboard input

### Integration Points
- **InputManager**: Receives keyboard input and forwards to debug mode
- **Main.js**: Creates debug mode instance and renders each frame
- **Utils.js**: Pathfinding logging for algorithm visibility
- **Renderer**: Uses Three.js to render debug visualizations

## Best Practices

1. **During Development**: Keep debug mode accessible with D key
2. **Before Pushing**: Disable console logging for production
3. **Performance Testing**: Use FPS counter to measure impact
4. **Bug Investigation**: Enable pathfinding logging to trace issues
5. **Code Review**: Use graph visualization to verify connectivity

## Example Debug Workflow

```
1. Start game normally
2. Press D to enable debug mode
3. Press P and L to see paths and coordinates
4. Play a few turns
5. Press C to see congestion building up
6. If agents get stuck, press X to see pathfinding logs
7. Open browser console (F12) to read detailed logs
8. Identify the problem (e.g., "Goal tile not walkable")
9. Fix the issue in code
10. Reload and test again with debug mode
```

## Contributing Debug Features

To add new debug visualizations:

1. Add visualization method to DebugMode class
2. Add toggle key in handleKeyPress() method
3. Add toggle property (showFeature: true)
4. Add cleanup in clear() method
5. Call visualization in render() method if enabled

Example:
```javascript
// Add property
this.showNewFeature = true;

// Add key handler
case 'n':
    this.showNewFeature = !this.showNewFeature;
    break;

// Add render call
if (this.showNewFeature) {
    this.visualizeNewFeature();
}

// Add visualization method
visualizeNewFeature() {
    // Create THREE.js objects
    // Add to this.debugGroup
}
```
