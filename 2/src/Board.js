/**
 * Board.js - Game board generation and management
 * 
 * The Board class generates a procedural 16x16 city grid with:
 * - Connected road network (main roads + intersecting streets)
 * - Buildings filling non-road spaces
 * - Special locations (HOMES, OFFICES, CAFE, HOSPITAL, JAIL, LANDMARK)
 * - Adjacency graph for efficient pathfinding
 * 
 * Generation Algorithm:
 * 1. Initialize empty grid with all BUILDING tiles
 * 2. Create main horizontal road through grid center
 * 3. Add 3-4 vertical roads at regular intervals
 * 4. Add random connecting roads for variety
 * 5. Mark road intersections (roads with 3+ neighbors)
 * 6. Place special locations on random road tiles
 * 7. Build adjacency graph for pathfinding
 */

class Board {
    /**
     * Get board constants with fallback values
     * @returns {Object} Board constants
     */
    static getConstants() {
        return (typeof window !== 'undefined' && window.GAME_CONSTANTS)
            ? window.GAME_CONSTANTS
            : {
                GRID_SIZE: 16,
                ROAD_RANDOM_DENSITY: 0.15,
                ROAD_ADJACENT_CHANCE: 0.4,
            };
    }

    /**
     * Constructor
     * @param {number} width - Grid width (default 16)
     * @param {number} height - Grid height (default 16)
     */
    constructor(width = 16, height = 16) {
        this.width = width;
        this.height = height;

        // 2D array of Tile objects [y][x]
        this.tiles = [];

        // Adjacency graph for pathfinding
        // Map where key is "x,y" and value is array of connected "x,y" strings
        this.graph = new Map();

        // Special locations tracking
        this.specialLocations = {
            homes: [],
            offices: [],
            cafes: [],
            hospitals: [],
            jails: [],
            landmarks: [],
        };

        // Generation state
        this.roadTiles = new Set();  // Track roads during generation
        this.intersectionTiles = new Set();  // Track intersections
    }

    /**
     * Generate the procedural city
     * Main entry point for board generation
     */
    generate() {
        try {
            // Step 1: Initialize empty grid
            this.initializeGrid();

            // Step 2: Generate road network
            this.generateRoadNetwork();

            // Step 3: Mark intersections
            this.markIntersections();

            // Step 4: Place special locations
            this.placeSpecialLocations();

            // Ensure required locations exist
            if (this.specialLocations.homes.length === 0 || this.specialLocations.offices.length === 0) {
                console.error('Board generation failed: missing HOME or OFFICE locations');
                return null;
            }

            // Step 4.5: Ensure redundant paths between homes and offices
            this.ensureRedundantPaths();

            // Step 5: Build adjacency graph
            this.buildAdjacencyGraph();

            return this;
        } catch (error) {
            console.error('Board generation failed:', error);
            return null;
        }
    }

    /**
     * Initialize grid with all BUILDING tiles
     * This serves as the default for non-road spaces
     */
    initializeGrid() {
        this.tiles = [];

        for (let y = 0; y < this.height; y++) {
            const row = [];

            for (let x = 0; x < this.width; x++) {
                // Create tile with BUILDING as default type
                const tile = new Tile(x, y, Tile.TYPES.BUILDING);
                tile.height = 2;  // Buildings have height
                row.push(tile);
            }

            this.tiles.push(row);
        }

        // Clear tracking sets
        this.roadTiles = new Set();
        this.intersectionTiles = new Set();
    }

    /**
     * Generate connected road network
     * 
     * Algorithm:
     * 1. Create main horizontal road through center
     * 2. Add 3-4 vertical roads at regular intervals
     * 3. Add random connecting roads
     * 4. Ensure network is connected
     */
    generateRoadNetwork() {
        const constants = Board.getConstants();
        // Step 1: Main horizontal road (through middle of grid)
        const mainRoadY = Math.floor(this.height / 2);
        for (let x = 0; x < this.width; x++) {
            this.setRoadTile(x, mainRoadY);
        }

        // Step 2: Vertical roads at regular intervals
        const verticalSpacing = Math.ceil(this.width / 4);
        for (let x = verticalSpacing; x < this.width; x += verticalSpacing) {
            for (let y = 0; y < this.height; y++) {
                this.setRoadTile(x, y);
            }
        }

        // Step 3: Add secondary horizontal roads
        const horizontalSpacing = Math.ceil(this.height / 4);
        for (let y = horizontalSpacing; y < this.height; y += horizontalSpacing) {
            if (y !== mainRoadY) {  // Don't duplicate main road
                for (let x = 0; x < this.width; x++) {
                    this.setRoadTile(x, y);
                }
            }
        }

        // Step 4: Add random connecting roads for variety
        const randomRoadCount = Math.floor((this.width * this.height) * constants.ROAD_RANDOM_DENSITY);
        for (let i = 0; i < randomRoadCount; i++) {
            const x = Utils.randomInt(1, this.width - 2);
            const y = Utils.randomInt(1, this.height - 2);
            this.setRoadTile(x, y);
            
            // Add adjacent roads to create wider paths
            if (Math.random() < constants.ROAD_ADJACENT_CHANCE) {
                const dirs = [{dx:1,dy:0}, {dx:-1,dy:0}, {dx:0,dy:1}, {dx:0,dy:-1}];
                const dir = dirs[Math.floor(Math.random() * dirs.length)];
                const nx = x + dir.dx;
                const ny = y + dir.dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    this.setRoadTile(nx, ny);
                }
            }
        }

        // Step 5: Add edge roads for connectivity
        // Top and bottom edges
        for (let x = 0; x < this.width; x++) {
            this.setRoadTile(x, 0);
            this.setRoadTile(x, this.height - 1);
        }

        // Left and right edges
        for (let y = 0; y < this.height; y++) {
            this.setRoadTile(0, y);
            this.setRoadTile(this.width - 1, y);
        }
    }

    /**
     * Mark road intersections (roads with 3+ road neighbors)
     * Intersections are faster to traverse than regular roads
     */
    markIntersections() {
        for (const key of this.roadTiles) {
            const [x, y] = key.split(',').map(Number);
            const roadNeighbors = this.getAdjacentRoadCount(x, y);

            // Intersection: 3+ road neighbors
            if (roadNeighbors >= 3) {
                const tile = this.getTile(x, y);
                if (tile) {
                    tile.type = Tile.TYPES.INTERSECTION;
                    tile.height = 0;  // Intersections are flat
                    this.intersectionTiles.add(key);
                    // Update walkability based on new type
                    tile.isWalkable = tile.determineWalkability(Tile.TYPES.INTERSECTION);
                    // Update color for the new type
                    tile.color = tile.getColorForType(Tile.TYPES.INTERSECTION);
                }
            }
        }
    }

    /**
     * Place special location tiles on random road tiles
     * Distribution:
     * - 2 HOMES (agent spawn points)
     * - 2 OFFICES (job destinations)
     * - 1 CAFE (optional stop)
    * - 1-2 HOSPITAL (service building)
    * - 1 JAIL (detention center)
     * - 1 LANDMARK (point of interest)
     */
    placeSpecialLocations() {
        const roadArray = Array.from(this.roadTiles);

        if (roadArray.length < 7) {
            console.warn('Not enough road tiles for all special locations');
            return;
        }

        // Shuffle road tiles to randomize placement
        const shuffled = Utils.deepClone(roadArray)
            .map(key => {
                const [x, y] = key.split(',').map(Number);
                return { x, y, key };
            })
            .sort(() => Math.random() - 0.5);

        let locationIndex = 0;

        // Place 4 HOMES (for 4 agents)
        for (let i = 0; i < 4 && locationIndex < shuffled.length; i++) {
            const pos = shuffled[locationIndex++];
            this.setSpecialTile(pos.x, pos.y, Tile.TYPES.HOME);
            this.specialLocations.homes.push(pos);
        }

        // Place 4 OFFICES (for 4 agents)
        for (let i = 0; i < 4 && locationIndex < shuffled.length; i++) {
            const pos = shuffled[locationIndex++];
            this.setSpecialTile(pos.x, pos.y, Tile.TYPES.OFFICE);
            this.specialLocations.offices.push(pos);
        }

        // Place 1 CAFE
        if (locationIndex < shuffled.length) {
            const pos = shuffled[locationIndex++];
            this.setSpecialTile(pos.x, pos.y, Tile.TYPES.CAFE);
            this.specialLocations.cafes.push(pos);
        }

        // Place 1-2 HOSPITALS
        const hospitalCount = (typeof Utils !== 'undefined' && Utils.randomInt)
            ? Utils.randomInt(1, 2)
            : (Math.random() < 0.5 ? 1 : 2);

        for (let i = 0; i < hospitalCount && locationIndex < shuffled.length; i++) {
            const pos = shuffled[locationIndex++];
            this.setSpecialTile(pos.x, pos.y, Tile.TYPES.HOSPITAL);
            this.specialLocations.hospitals.push(pos);
        }

        // Place 1 JAIL (before landmarks)
        if (locationIndex < shuffled.length) {
            const pos = shuffled[locationIndex++];
            this.setSpecialTile(pos.x, pos.y, Tile.TYPES.JAIL);
            this.specialLocations.jails.push(pos);
        }

        // Place 5-7 LANDMARKS (varied types with bonuses)
        const landmarkCount = (typeof Utils !== 'undefined' && Utils.randomInt)
            ? Utils.randomInt(5, 7)
            : (Math.floor(Math.random() * 3) + 5);

        // Define landmark configurations with bonuses
        const landmarkConfigs = [
            { type: 'PARK', delay: 2, bonus: 'STRESS_RELIEF' },           // +1 turn
            { type: 'PLAZA', delay: 1, bonus: 'QUICK_PHOTO' },            // Only 1 turn
            { type: 'MUSEUM', delay: 2, bonus: 'SKIP_TRAFFIC' },          // Skip next jam
            { type: 'STATUE', delay: 2, bonus: null },
            { type: 'FOUNTAIN', delay: 2, bonus: null },
            { type: 'MONUMENT', delay: 3, bonus: null },
            { type: 'SCULPTURE', delay: 2, bonus: null },
            { type: 'HISTORIC_BUILDING', delay: 3, bonus: null },
            { type: 'TEMPLE', delay: 3, bonus: null },
            { type: 'GARDEN', delay: 2, bonus: null },
            { type: 'CLOCK_TOWER', delay: 2, bonus: null },
            { type: 'BRIDGE', delay: 2, bonus: null },
            { type: 'TOWER', delay: 3, bonus: null },
        ];

        // Shuffle and select unique landmark types
        const shuffledConfigs = Utils.deepClone(landmarkConfigs)
            .sort(() => Math.random() - 0.5)
            .slice(0, landmarkCount);

        // Try to include at least one of each major type if possible
        const majorTypes = ['PARK', 'MUSEUM', 'PLAZA', 'TEMPLE', 'HISTORIC_BUILDING'];
        const usedTypes = new Set();

        for (let i = 0; i < landmarkCount && locationIndex < shuffled.length; i++) {
            const pos = shuffled[locationIndex++];
            const tile = this.getTile(pos.x, pos.y);

            // Ensure variety: pick from shuffled configs
            let config = shuffledConfigs[i];
            
            // Ensure at least one of each major type if we have room
            if (i < majorTypes.length && !usedTypes.has(majorTypes[i])) {
                config = landmarkConfigs.find(c => c.type === majorTypes[i]) || config;
            }

            usedTypes.add(config.type);

            // Set landmark properties
            tile.type = Tile.TYPES.LANDMARK;
            tile.isWalkable = true;
            tile.landmarkType = config.type;
            tile.photoDelay = config.delay;
            tile.landmarkBonus = config.bonus;

            this.specialLocations.landmarks.push(pos);
            this.roadTiles.add(`${pos.x},${pos.y}`);
        }

        // Create a "tourist district" by clustering some landmarks
        if (this.specialLocations.landmarks.length >= 3) {
            const clusterStart = Math.floor(this.specialLocations.landmarks.length / 2);
            const clusterSize = Math.min(2, this.specialLocations.landmarks.length - clusterStart);
            
            for (let i = 0; i < clusterSize && clusterStart + i < this.specialLocations.landmarks.length; i++) {
                const landmark = this.specialLocations.landmarks[clusterStart + i];
                
                // Place adjacent landmarks near existing one
                const directions = [
                    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
                    { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
                ];
                
                for (const dir of directions) {
                    const nx = landmark.x + dir.dx * 2;
                    const ny = landmark.y + dir.dy * 2;
                    
                    if (nx > 0 && nx < this.width - 1 && ny > 0 && ny < this.height - 1) {
                        const neighborTile = this.getTile(nx, ny);
                        if (neighborTile && neighborTile.type !== 'LANDMARK' && this.roadTiles.has(`${nx},${ny}`)) {
                            // Create scenic area connection
                            neighborTile.type = Tile.TYPES.ROAD;
                            neighborTile.isWalkable = true;
                        }
                    }
                }
            }
        }
    }

    /**
     * Build adjacency graph for pathfinding
     * Graph connects only walkable tiles (ROAD, INTERSECTION, special locations)
     * Uses 4-directional (cardinal) movement
     */
    buildAdjacencyGraph() {
        this.graph.clear();
        for (const key of this.roadTiles) {
            const [x, y] = key.split(',').map(Number);
            const neighbors = [];

            // Check 4 cardinal directions
            const directions = [
                { dx: -1, dy: 0 },  // West
                { dx: 1, dy: 0 },   // East
                { dx: 0, dy: -1 },  // North
                { dx: 0, dy: 1 },   // South
            ];

            for (const dir of directions) {
                const nx = x + dir.dx;
                const ny = y + dir.dy;
                const neighborKey = `${nx},${ny}`;

                // Only connect to other road/intersection tiles
                if (this.roadTiles.has(neighborKey)) {
                    neighbors.push(neighborKey);
                }
            }

            if (neighbors.length > 0) {
                this.graph.set(key, neighbors);
            }
        }
    }

    /**
     * Ensure at least two distinct paths between each home/office pair
     * Adds additional roads if needed.
     */
    ensureRedundantPaths() {
        const homes = this.specialLocations.homes || [];
        const offices = this.specialLocations.offices || [];
        if (homes.length === 0 || offices.length === 0) {
            return;
        }

        const pairs = [];
        for (const home of homes) {
            for (const office of offices) {
                pairs.push({ start: home, goal: office });
            }
        }

        let attempts = 0;
        const maxAttempts = 6;

        let pending = pairs.filter(pair => !this.hasAlternatePath(pair.start, pair.goal));

        while (pending.length > 0 && attempts < maxAttempts) {
            for (const pair of pending) {
                this.addDetourRoads(pair.start, pair.goal);
            }

            attempts++;
            pending = pairs.filter(pair => !this.hasAlternatePath(pair.start, pair.goal));
        }

        if (pending.length > 0) {
            console.warn(`Could not ensure redundant paths for ${pending.length} home/office pairs after ${attempts} attempts`);
        }
    }

    /**
     * Check if there is an alternate path between two points
     * @param {{x:number,y:number}} start
     * @param {{x:number,y:number}} goal
     * @returns {boolean}
     */
    hasAlternatePath(start, goal) {
        const primaryPath = Utils.findPath(this, start, goal);
        if (!primaryPath || primaryPath.length < 2) {
            return false;
        }

        // Try blocking a few tiles along the path to see if a second path exists
        const candidates = primaryPath.slice(1, -1);
        const step = Math.max(1, Math.floor(candidates.length / 4));

        for (let i = 0; i < candidates.length; i += step) {
            const point = candidates[i];
            const tile = this.getTile(point.x, point.y);
            if (!tile || tile.type === Tile.TYPES.HOME || tile.type === Tile.TYPES.OFFICE) {
                continue;
            }

            const originalBlocked = tile.isBlocked;
            tile.isBlocked = true;
            const altPath = Utils.findPath(this, start, goal);
            tile.isBlocked = originalBlocked;

            if (altPath && altPath.length > 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Add a detour corridor between two points to encourage multiple paths
     */
    addDetourRoads(start, goal) {
        const offsets = [1, -1, 2, -2];
        const yOffsets = offsets.map(offset => start.y + offset).filter(y => y >= 1 && y < this.height - 1);
        const xOffsets = offsets.map(offset => start.x + offset).filter(x => x >= 1 && x < this.width - 1);

        // Try horizontal detour
        for (const yOffset of yOffsets) {
            if (yOffset !== start.y && yOffset !== goal.y) {
                this.carveRoadLine(start.x, start.y, start.x, yOffset);
                this.carveRoadLine(goal.x, goal.y, goal.x, yOffset);
                this.carveRoadLine(start.x, yOffset, goal.x, yOffset);
                return;
            }
        }

        // Try vertical detour
        for (const xOffset of xOffsets) {
            if (xOffset !== start.x && xOffset !== goal.x) {
                this.carveRoadLine(start.x, start.y, xOffset, start.y);
                this.carveRoadLine(goal.x, goal.y, xOffset, goal.y);
                this.carveRoadLine(xOffset, start.y, xOffset, goal.y);
                return;
            }
        }

        // Fallback: add random extra roads
        const extra = Math.floor((this.width * this.height) * 0.05);
        for (let i = 0; i < extra; i++) {
            const x = Utils.randomInt(1, this.width - 2);
            const y = Utils.randomInt(1, this.height - 2);
            this.setRoadTileIfNotSpecial(x, y);
        }
    }

    /**
     * Carve a straight road line between two points (orthogonal only)
     */
    carveRoadLine(x1, y1, x2, y2) {
        if (x1 === x2) {
            const start = Math.min(y1, y2);
            const end = Math.max(y1, y2);
            for (let y = start; y <= end; y++) {
                this.setRoadTileIfNotSpecial(x1, y);
            }
        } else if (y1 === y2) {
            const start = Math.min(x1, x2);
            const end = Math.max(x1, x2);
            for (let x = start; x <= end; x++) {
                this.setRoadTileIfNotSpecial(x, y1);
            }
        }
    }

    /**
     * Mark a tile as road unless it's a special location
     */
    setRoadTileIfNotSpecial(x, y) {
        const tile = this.getTile(x, y);
        if (!tile) {
            return;
        }

        const specialTypes = [
            Tile.TYPES.HOME,
            Tile.TYPES.OFFICE,
            Tile.TYPES.CAFE,
            Tile.TYPES.HOSPITAL,
            Tile.TYPES.LANDMARK,
        ];

        if (specialTypes.includes(tile.type)) {
            return;
        }

        this.setRoadTile(x, y);
    }

    /**
     * Get a random road tile (optionally excluding special locations)
     * @param {boolean} excludeSpecial
     * @returns {Tile|null}
     */
    getRandomRoadTile(excludeSpecial = true) {
        const roadArray = Array.from(this.roadTiles);
        if (roadArray.length === 0) {
            return null;
        }

        for (let i = 0; i < 20; i++) {
            const key = roadArray[Utils.randomInt(0, roadArray.length - 1)];
            const [x, y] = key.split(',').map(Number);
            const tile = this.getTile(x, y);
            if (!tile) {
                continue;
            }

            if (excludeSpecial) {
                const specialTypes = [
                    Tile.TYPES.HOME,
                    Tile.TYPES.OFFICE,
                    Tile.TYPES.CAFE,
                    Tile.TYPES.HOSPITAL,
                    Tile.TYPES.LANDMARK,
                ];
                if (specialTypes.includes(tile.type)) {
                    continue;
                }
            }

            return tile;
        }

        return null;
    }

    /**
     * Helper: Mark a tile as a ROAD
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    setRoadTile(x, y) {
        if (this.isValidPosition(x, y)) {
            const key = `${x},${y}`;
            this.roadTiles.add(key);

            const tile = this.getTile(x, y);
            if (tile) {
                tile.type = Tile.TYPES.ROAD;
                tile.height = 0;  // Roads are flat
                // Update walkability based on new type
                tile.isWalkable = tile.determineWalkability(Tile.TYPES.ROAD);
                // Update color for the new type
                tile.color = tile.getColorForType(Tile.TYPES.ROAD);
            }
        }
    }

    /**
     * Helper: Mark a tile as a special location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} type - Special tile type
     */
    setSpecialTile(x, y, type) {
        if (this.isValidPosition(x, y)) {
            const tile = this.getTile(x, y);
            if (tile) {
                tile.type = type;
                tile.height = 0;  // Special locations are flat
                // Update walkability based on new type
                tile.isWalkable = tile.determineWalkability(type);
                // Update color for the new type
                tile.color = tile.getColorForType(type);
            }
        }
    }

    /**
     * Helper: Count adjacent road tiles
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Count of adjacent road tiles
     */
    getAdjacentRoadCount(x, y) {
        let count = 0;
        const directions = [
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
        ];

        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (this.roadTiles.has(`${nx},${ny}`)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Get tile at coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Tile|null} Tile object or null if out of bounds
     */
    getTile(x, y) {
        if (!this.isValidPosition(x, y)) {
            console.error(`Board.getTile: Invalid coordinates (${x}, ${y})`);
            return null;
        }
        return this.tiles[y][x];
    }

    /**
     * Check if coordinates are within valid bounds
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if position is valid
     */
    isValidPosition(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    /**
     * Get neighbors of a tile (walkable adjacent tiles)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Array} Array of Tile objects
     */
    getNeighbors(x, y) {
        const neighbors = [];
        const directions = [
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
        ];

        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            const tile = this.getTile(nx, ny);

            if (tile && tile.isPassable()) {
                neighbors.push(tile);
            }
        }

        return neighbors;
    }

    /**
     * Get random special location of a specific type
     * @param {string} type - Location type ('HOME', 'OFFICE', 'CAFE', etc.)
     * @returns {Object|null} Random location {x, y} or null if none available
     */
    getRandomSpecialLocation(type) {
        const locations = this.specialLocations[type.toLowerCase() + 's'];

        if (!locations || locations.length === 0) {
            return null;
        }

        return locations[Utils.randomInt(0, locations.length - 1)];
    }

    /**
     * Get all special locations of a type
     * @param {string} type - Location type
     * @returns {Array} Array of {x, y} objects
     */
    getSpecialLocations(type) {
        const key = type.toLowerCase() + 's';
        return this.specialLocations[key] || [];
    }

    /**
     * Update all tiles (called once per turn)
     */
    update() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tile = this.getTile(x, y);
                if (tile) {
                    tile.update();
                }
            }
        }
    }

    /**
     * Get board statistics for debugging
     * @returns {Object} Board statistics
     */
    getStats() {
        const stats = {
            width: this.width,
            height: this.height,
            totalTiles: this.width * this.height,
            roads: this.roadTiles.size,
            intersections: this.intersectionTiles.size,
            buildings: this.width * this.height - this.roadTiles.size,
            specialLocations: {
                homes: this.specialLocations.homes.length,
                offices: this.specialLocations.offices.length,
                cafes: this.specialLocations.cafes.length,
                hospitals: this.specialLocations.hospitals.length,
                jails: this.specialLocations.jails.length,
                landmarks: this.specialLocations.landmarks.length,
            },
            graphNodes: this.graph.size,
        };

        return stats;
    }

    /**
     * Serialize board for debugging
     * @returns {Object} Serialized board data
     */
    serialize() {
        return {
            dimensions: `${this.width}x${this.height}`,
            stats: this.getStats(),
            specialLocations: this.specialLocations,
        };
    }
}

// Expose to browser global scope when available
if (typeof window !== 'undefined') {
    window.Board = Board;
    window.__boardLoaded = true;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Board;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Board;
}
