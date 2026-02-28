# Debug Mode Quick Reference

## Keyboard Controls

| Key | Action |
|-----|--------|
| **D** | Toggle debug mode ON/OFF |
| **P** | Toggle agent path visualization |
| **L** | Toggle coordinate labels |
| **C** | Toggle congestion display |
| **G** | Toggle graph visualization |
| **X** | Toggle pathfinding logging |

## What Each Visualization Shows

### FPS Counter (Always Visible When Debug On)
```
FPS: 60
```
- Appears in top-left corner
- Real-time frame rate monitoring
- Green text on dark background

### Agent Paths (Press P)
```
Red/Green/Blue/Yellow Lines
```
- Colored lines from agent → goal
- Each agent has unique color
- Shows planned routes
- Helps verify pathfinding works

### Coordinates (Press L)
```
[0,0] [1,0] [2,0] ...
[0,1] [1,1] [2,1] ...
```
- Grid coordinates on tiles
- Shows every 2nd tile to reduce clutter
- Green text labels
- Helps understand map layout

### Congestion (Press C)
```
🟢 0    🟡 2    🔴 4
```
- Number shows congestion level (0-5)
- Green = low traffic
- Red = high traffic
- Only appears on tiles with traffic

### Graph (Press G)
```
━━━━━ Blue Lines ━━━━━
```
- Shows all walkable tile connections
- Light blue semi-transparent lines
- Helps verify pathfinding graph
- Can impact performance with many connections

### Logging (Press X)
```
Console Output:
[Pathfinding] Starting pathfinding from (3,5) to (12,10)
[Pathfinding] Path found with 15 steps
```
- Detailed pathfinding algorithm steps
- View in browser console (F12)
- Shows success/failure reasons

## Quick Debugging Checklist

- [ ] Agent not moving?
  - Enable paths (P) to see if route exists
  - Enable logging (X) to see pathfinding errors
  
- [ ] Agent stuck in one place?
  - Check congestion (C) - is tile blocked?
  - Check graph (G) - is tile connected?
  
- [ ] Pathfinding failing?
  - Enable coordinates (L) to verify positions
  - Enable logging (X) to see specific errors
  - Check goal tile is walkable
  
- [ ] Performance issues?
  - Check FPS counter
  - Disable graph (G) - most expensive
  - Disable labels (L) - second most expensive
  
## Console Access

Open Developer Tools: **F12** or Right-click → Inspect → Console

View debug messages:
```javascript
// Look for messages like:
// [Pathfinding] Starting pathfinding from...
// [Pathfinding] Path found with X steps
// [Pathfinding] No path found after Y iterations
```

## Global Debug Object

In browser console:
```javascript
// Access debug mode
window.gameDebugMode

// Get tile info
window.gameDebugMode.getTileDebugInfo(x, y)

// Control features programmatically
window.gameDebugMode.showPaths = true
window.gameDebugMode.logPathfinding = true
```

## Tips

1. **Start with D + P**: See FPS and agent paths
2. **Add L when confused**: See exact tile coordinates
3. **Use C to find bottlenecks**: See where traffic builds up
4. **Enable X for pathfinding bugs**: See algorithm decisions
5. **Use G sparingly**: Performance impact is high
6. **F12 is your friend**: Always open console when debugging

## Common Debug Combinations

### Basic Debug View
- D + P + L
- Shows: FPS, paths, coordinates

### Traffic Analysis
- D + P + C
- Shows: FPS, paths, congestion

### Full Debug (Use Carefully)
- D + P + L + C + G + X
- Shows: Everything (may impact performance)

### Pathfinding Investigation
- D + P + X (+ F12 for console)
- Shows: Paths visually + detailed logs

### Performance Profiling
- D only
- Shows: FPS counter only
- Minimal impact, use for baseline
