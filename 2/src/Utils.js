/**
 * Utils.js - Helper functions and utilities
 */

const Utils = {
    /**
     * Debug logging function for pathfinding
     */
    debugPathfinding: false,

    /**
     * Enable/disable pathfinding debug logging
     * @param {boolean} enabled - Whether to enable debug logging
     */
    setDebugPathfinding(enabled) {
        this.debugPathfinding = enabled;
    },

    /**
     * Log pathfinding debug message
     * @param {string} message - Debug message
     * @param {*} data - Optional data to log
     */
    logPathfinding(message, data) {
        if (this.debugPathfinding) {
            console.log(`%c[Pathfinding] ${message}`, 'color: #ffaa00; font-size: 11px', data || '');
        }
    },

    /**
     * Generate random integer between min and max (inclusive)
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Generate random float between min and max
     */
    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * Manhattan distance between two points
     */
    manhattanDistance(p1, p2) {
        return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
    },

    /**
     * Euclidean distance between two points
     */
    euclideanDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Linear interpolation
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Check if point is within bounds
     */
    isInBounds(point, width, height) {
        return point.x >= 0 && point.x < width && point.y >= 0 && point.y < height;
    },

    /**
     * Deep clone object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Get cardinal neighbors (N, S, E, W)
     */
    getCardinalNeighbors(x, y, width, height) {
        const neighbors = [];
        const directions = [
            { x: 0, y: -1 },  // N
            { x: 1, y: 0 },   // E
            { x: 0, y: 1 },   // S
            { x: -1, y: 0 },  // W
        ];

        for (let dir of directions) {
            const nx = x + dir.x;
            const ny = y + dir.y;
            if (this.isInBounds({ x: nx, y: ny }, width, height)) {
                neighbors.push({ x: nx, y: ny });
            }
        }

        return neighbors;
    },

    /**
     * A* Pathfinding Algorithm
     * 
     * Finds the shortest path between start and goal positions on the game board.
     * Uses Manhattan distance as the heuristic function.
     * 
     * @param {Board} board - The game board object
     * @param {Object} start - Starting position {x, y}
     * @param {Object} goal - Goal position {x, y}
     * @returns {Array} Array of {x, y} coordinates representing the path (empty if no path found)
     * 
     * Algorithm:
     * 1. Initialize open set with start node
     * 2. While open set is not empty:
     *    a. Find node with lowest f-score in open set
     *    b. If it's the goal, reconstruct and return path
     *    c. Move current from open to closed set
     *    d. For each neighbor:
     *       - Skip if blocked or non-walkable
     *       - Calculate g-score (cost from start)
     *       - If neighbor in open set with better g-score, skip
     *       - Otherwise, record path and scores
     * 3. Return empty array if no path found
     */
    findPath(board, start, goal) {
        // Validation
        if (!board || !start || !goal) {
            console.error('Utils.findPath: Missing parameters', { board: !!board, start: !!start, goal: !!goal });
            return [];
        }

        if (!board.isValidPosition(start.x, start.y) || !board.isValidPosition(goal.x, goal.y)) {
            console.error(`Utils.findPath: Position out of bounds. Start: (${start.x},${start.y}), Goal: (${goal.x},${goal.y})`);
            return [];
        }

        const startTile = board.getTile(start.x, start.y);
        const goalTile = board.getTile(goal.x, goal.y);

        // Start and goal must be walkable
        if (!startTile) {
            console.error(`Utils.findPath: Start tile is null at (${start.x},${start.y})`);
            return [];
        }
        if (!goalTile) {
            console.error(`Utils.findPath: Goal tile is null at (${goal.x},${goal.y})`);
            return [];
        }
        if (!startTile.isWalkable) {
            console.error(`Utils.findPath: Start tile not walkable. Type: ${startTile.type}`);
            return [];
        }
        if (!goalTile.isWalkable) {
            console.error(`Utils.findPath: Goal tile not walkable. Type: ${goalTile.type}`);
            return [];
        }

        this.logPathfinding(`Starting pathfinding from (${start.x},${start.y}) to (${goal.x},${goal.y})`);

        // A* sets
        const openSet = new Set();
        const closedSet = new Set();
        
        // Score maps: key format is "x,y"
        const gScore = new Map(); // Cost from start to current node
        const fScore = new Map(); // gScore + heuristic
        const cameFrom = new Map(); // For path reconstruction

        // If start is goal, return immediately
        if (start.x === goal.x && start.y === goal.y) {
            this.logPathfinding('Start is goal, returning immediately');
            return [{ x: start.x, y: start.y }];
        }

        // Initialize start node
        const startKey = `${start.x},${start.y}`;
        const goalKey = `${goal.x},${goal.y}`;

        openSet.add(startKey);
        gScore.set(startKey, 0);
        fScore.set(startKey, this.manhattanDistance(start, goal));

        let iterations = 0;
        const maxIterations = 10000; // Prevent infinite loops

        // Main A* loop
        while (openSet.size > 0) {
            iterations++;
            if (iterations > maxIterations) {
                this.logPathfinding(`Max iterations exceeded (${maxIterations})`);
                console.error(`Utils.findPath: Max iterations exceeded (${maxIterations})`);
                return [];
            }

            // Find node in openSet with lowest fScore
            let current = null;
            let lowestF = Infinity;

            for (let nodeKey of openSet) {
                const f = fScore.get(nodeKey) ?? Infinity;
                if (f < lowestF) {
                    lowestF = f;
                    current = nodeKey;
                }
            }

            // Safety check: if no current node found, break to avoid errors
            if (!current) {
                console.error('Utils.findPath: Failed to select current node from open set');
                return [];
            }

            // Goal reached
            if (current === goalKey) {
                const path = this.reconstructPath(cameFrom, current);
                this.logPathfinding(`Path found with ${path.length} steps`, path);
                return path;
            }

            openSet.delete(current);
            closedSet.add(current);

            // Parse current coordinates
            const [currentX, currentY] = current.split(',').map(Number);

            // Check all walkable neighbors
            const neighbors = this.getWalkableNeighbors(board, currentX, currentY, goal);

            for (let neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;

                // Skip if already evaluated
                if (closedSet.has(neighborKey)) {
                    continue;
                }

                // Get the tile to check movement cost
                const neighborTile = board.getTile(neighbor.x, neighbor.y);
                const movementCost = neighborTile.getMovementCost ? neighborTile.getMovementCost() : 1;

                // Calculate tentative gScore
                const currentG = gScore.get(current) ?? Infinity;
                const tentativeG = currentG + movementCost;

                // If neighbor not in open set, add it
                if (!openSet.has(neighborKey)) {
                    openSet.add(neighborKey);
                } else if (tentativeG >= (gScore.get(neighborKey) ?? Infinity)) {
                    // This path is not better, skip
                    continue;
                }

                // Record this path
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeG);
                fScore.set(neighborKey, tentativeG + this.manhattanDistance(neighbor, goal));
            }
        }

        // No path found
        this.logPathfinding(`No path found after ${iterations} iterations`, { start, goal });
        console.error(`Utils.findPath: No path found after ${iterations} iterations`);
        return [];
    },

    /**
     * Reconstruct path from A* result
     * 
     * Follows cameFrom map backward from goal to start to build the path array.
     * 
     * @param {Map} cameFrom - Map tracking where each node came from
     * @param {String} current - Current node key (goal) in format "x,y"
     * @returns {Array} Array of {x, y} coordinates from start to goal
     */
    reconstructPath(cameFrom, current) {
        const path = [];
        
        // Build path backward from goal
        while (cameFrom.has(current)) {
            const [x, y] = current.split(',').map(Number);
            path.unshift({ x, y }); // Add to front
            current = cameFrom.get(current);
        }

        // Add start position (first iteration doesn't have cameFrom entry)
        const [x, y] = current.split(',').map(Number);
        path.unshift({ x, y });

        return path;
    },

    /**
     * Get walkable neighbors for pathfinding
     * 
     * Returns all adjacent tiles that are:
     * - Within board bounds
     * - ROAD or INTERSECTION type (these can always be traversed)
     * - A building/special tile **only if** it is the final goal and entry is from a road
     * - Not blocked
     * 
     * This enforces the rule that agents cannot cut through buildings or move
     * directly from one building to another. A building tile is added only when
     * it is the target of the path and the current tile is a road or
     * intersection.  Without this check, the A* search could step into a building
     * simply because it was marked as walkable (HOME/OFFICE/etc) or because it
     * happened to be the goal while standing inside another building.
     * 
     * @param {Board} board - The game board
     * @param {Number} x - Current X coordinate
     * @param {Number} y - Current Y coordinate
     * @returns {Array} Array of {x, y} neighbor positions
     */
    getWalkableNeighbors(board, x, y, goal) {
        const neighbors = [];
        const directions = [
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
        ];

        // helper for identifying building/special tile types
        const isBuildingType = (type) => {
            const btypes = [
                Tile.TYPES.HOME,
                Tile.TYPES.OFFICE,
                Tile.TYPES.CAFE,
                Tile.TYPES.LANDMARK,
                Tile.TYPES.HOSPITAL,
                Tile.TYPES.JAIL,
            ];
            return btypes.includes(type);
        };

        // determine if current tile is a road/intersection (needed for building entry)
        const currentTile = board.getTile(x, y);
        const currentIsRoad = currentTile &&
            (currentTile.type === Tile.TYPES.ROAD || currentTile.type === Tile.TYPES.INTERSECTION);

        for (let dir of directions) {
            const nx = x + dir.x;
            const ny = y + dir.y;

            if (!board.isValidPosition(nx, ny)) continue;

            const tile = board.getTile(nx, ny);
            if (!tile || tile.isBlocked) continue;

            const isGoal = goal && nx === goal.x && ny === goal.y;

            // road/intersection can always be used
            if (tile.type === Tile.TYPES.ROAD || tile.type === Tile.TYPES.INTERSECTION) {
                neighbors.push({ x: nx, y: ny });
                continue;
            }

            // allow entering a building/special tile only if it's the goal **and**
            // the current tile is a road or intersection.  This prevents the
            // algorithm from stepping directly between building tiles.  The
            // `currentIsRoad` flag was previously removed but is now required
            // again per the latest rule set.
            if (isGoal && isBuildingType(tile.type) && currentIsRoad) {
                neighbors.push({ x: nx, y: ny });
            }
            // otherwise ignore non-road tiles entirely
        }

        return neighbors;
    },
};

// Expose to browser global scope when available
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
