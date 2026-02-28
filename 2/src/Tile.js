/**
 * Tile.js - Tile class representing a single grid cell
 * 
 * A Tile represents one cell in the city grid and can be:
 * - A walkable road/intersection where agents move
 * - A building that blocks movement
 * - A special location (HOME, OFFICE, CAFE, LANDMARK, HOSPITAL)
 * 
 * Tiles track congestion (traffic buildup) and blockages (accidents, construction).
 */

class Tile {
    /**
     * Tile type enumeration
     */
    static TYPES = {
        ROAD: 'ROAD',
        INTERSECTION: 'INTERSECTION',
        BUILDING: 'BUILDING',
        HOME: 'HOME',
        OFFICE: 'OFFICE',
        CAFE: 'CAFE',
        LANDMARK: 'LANDMARK',
        HOSPITAL: 'HOSPITAL',
        JAIL: 'JAIL',
    };

    /**
     * Landmark type enumeration
     */
    static LANDMARK_TYPES = {
        STATUE: 'STATUE',
        FOUNTAIN: 'FOUNTAIN',
        PARK: 'PARK',
        MONUMENT: 'MONUMENT',
        TOWER: 'TOWER',
        MUSEUM: 'MUSEUM',
        BRIDGE: 'BRIDGE',
        SCULPTURE: 'SCULPTURE',
        HISTORIC_BUILDING: 'HISTORIC_BUILDING',
        PLAZA: 'PLAZA',
        TEMPLE: 'TEMPLE',
        CLOCK_TOWER: 'CLOCK_TOWER',
        GARDEN: 'GARDEN',
    };

    /**
     * Constructor
     * @param {number} x - Grid X coordinate
     * @param {number} y - Grid Y coordinate
     * @param {string} type - Tile type (from TYPES enum)
     */
    constructor(x, y, type = Tile.TYPES.ROAD) {
        // Position
        this.x = x;
        this.y = y;

        // Type and classification
        this.type = type;
        this.isWalkable = this.determineWalkability(type);

        // Connectivity
        this.connections = [];  // Array of {x, y} coordinates of adjacent tiles

        // Congestion tracking (0-5 scale)
        this.congestion = 0;    // Current congestion level
        this.maxCongestion = 5;

        // Blockage state (accidents, construction, etc.)
        this.isBlocked = false;
        this.blockTurnsRemaining = 0;
        this.blockType = null;  // 'accident', 'construction', etc.

        // Landmark properties (only set for LANDMARK type tiles)
        this.landmarkType = null;    // Type of landmark (STATUE, FOUNTAIN, PARK, MONUMENT, TOWER, etc.)
        this.photoDelay = 0;         // Number of turns (1-3) for photo delay
        this.landmarkBonus = null;   // Bonus type: 'STRESS_RELIEF', 'SKIP_TRAFFIC', 'QUICK_PHOTO', or null

        // Rendering hints
        this.height = this.getDefaultHeight(type);
        this.color = this.getColorForType(type);

        // Agent occupancy
        this.occupiedBy = null;  // Agent ID if occupied, null otherwise
    }

    /**
     * Determine if a tile type is walkable by agents
     * @param {string} type - Tile type to check
     * @returns {boolean} True if agents can walk on this tile
     */
    determineWalkability(type) {
        const walkableTypes = [
            Tile.TYPES.ROAD,
            Tile.TYPES.INTERSECTION,
            Tile.TYPES.HOME,
            Tile.TYPES.OFFICE,
            Tile.TYPES.CAFE,
            Tile.TYPES.LANDMARK,
            Tile.TYPES.HOSPITAL,
            Tile.TYPES.JAIL,
        ];
        return walkableTypes.includes(type);
    }

    /**
     * Get default height for tile type (for 3D visualization)
     * @param {string} type - Tile type
     * @returns {number} Height value
     */
    getDefaultHeight(type) {
        const heights = {
            [Tile.TYPES.ROAD]: 0,
            [Tile.TYPES.INTERSECTION]: 0,
            [Tile.TYPES.BUILDING]: 2,
            [Tile.TYPES.HOME]: 1.5,
            [Tile.TYPES.OFFICE]: 3,
            [Tile.TYPES.CAFE]: 1,
            [Tile.TYPES.LANDMARK]: 2.5,
            [Tile.TYPES.HOSPITAL]: 3.5,
        };
        return heights[type] || 0;
    }

    /**
     * Get color for tile type (for rendering)
     * @param {string} type - Tile type
     * @returns {number} Hex color value
     */
    getColorForType(type) {
        const colors = {
            [Tile.TYPES.ROAD]: 0x666666,        // Gray
            [Tile.TYPES.INTERSECTION]: 0x888888, // Light gray
            [Tile.TYPES.BUILDING]: 0x4d7fff,    // Blue
            [Tile.TYPES.HOME]: 0xffc107,        // Amber
            [Tile.TYPES.OFFICE]: 0x2196f3,      // Light blue
            [Tile.TYPES.CAFE]: 0xffd43b,        // Yellow
            [Tile.TYPES.LANDMARK]: 0xb71c1c,    // Dark red
            [Tile.TYPES.HOSPITAL]: 0xff6b6b,    // Red
            [Tile.TYPES.JAIL]: 0x333333,        // Dark gray
        };
        return colors[type] || 0xcccccc;  // Default gray
    }

    /**
     * Add a connection to an adjacent tile
     * @param {number} x - Adjacent tile X coordinate
     * @param {number} y - Adjacent tile Y coordinate
     */
    addConnection(x, y) {
        // Prevent duplicates
        const exists = this.connections.some(c => c.x === x && c.y === y);
        if (!exists) {
            this.connections.push({ x, y });
        }
    }

    /**
     * Remove a connection to an adjacent tile
     * @param {number} x - Adjacent tile X coordinate
     * @param {number} y - Adjacent tile Y coordinate
     */
    removeConnection(x, y) {
        this.connections = this.connections.filter(c => !(c.x === x && c.y === y));
    }

    /**
     * Get all connections as array
     * @returns {Array} Array of {x, y} objects
     */
    getConnections() {
        return [...this.connections];
    }

    /**
     * Increase congestion on this tile
     * Congestion represents traffic buildup and can slow agents down
     */
    increaseCongestion() {
        this.congestion = Math.min(this.congestion + 1, this.maxCongestion);
    }

    /**
     * Decrease congestion on this tile
     * Congestion naturally decays as traffic clears
     */
    decreaseCongestion() {
        this.congestion = Math.max(this.congestion - 1, 0);
    }

    /**
     * Set congestion to a specific level
     * @param {number} level - Congestion level (0-5)
     */
    setCongestion(level) {
        this.congestion = Utils.clamp(level, 0, this.maxCongestion);
    }

    /**
     * Get current congestion as percentage (0.0-1.0)
     * @returns {number} Congestion percentage
     */
    getCongestionPercentage() {
        return this.congestion / this.maxCongestion;
    }

    /**
     * Block this tile (e.g., accident, construction)
     * @param {number} turns - Number of turns to remain blocked
     * @param {string} blockType - Type of blockage ('accident', 'construction', etc.)
     */
    blockTile(turns, blockType = 'accident') {
        this.isBlocked = true;
        this.blockTurnsRemaining = turns;
        this.blockType = blockType;
    }

    /**
     * Unblock this tile immediately
     */
    unblockTile() {
        this.isBlocked = false;
        this.blockTurnsRemaining = 0;
        this.blockType = null;
    }

    /**
     * Update blockage timer
     * Called once per turn to decrement blockage duration
     */
    updateBlock() {
        if (this.isBlocked && this.blockTurnsRemaining > 0) {
            this.blockTurnsRemaining--;

            // Clear blockage when timer expires
            if (this.blockTurnsRemaining <= 0) {
                this.unblockTile();
            }
        }
    }

    /**
     * Check if tile is passable (not blocked and walkable)
     * @returns {boolean} True if agents can move through this tile
     */
    isPassable() {
        return this.isWalkable && !this.isBlocked;
    }

    /**
     * Get movement cost for pathfinding
     * Accounts for congestion and tile type
     * @returns {number} Movement cost (1.0 = normal, >1.0 = slower)
     */
    getMovementCost() {
        let baseCost = 1.0;

        // Congestion adds cost
        baseCost += this.getCongestionPercentage() * 0.5;

        // Intersections might be faster
        if (this.type === Tile.TYPES.INTERSECTION) {
            baseCost *= 0.9;
        }

        return baseCost;
    }

    /**
     * Set occupancy state
     * @param {number|null} agentId - Agent ID occupying this tile, or null
     */
    setOccupiedBy(agentId) {
        this.occupiedBy = agentId;
    }

    /**
     * Check if tile is occupied
     * @returns {boolean} True if an agent is on this tile
     */
    isOccupied() {
        return this.occupiedBy !== null;
    }

    /**
     * Update tile state (called once per turn)
     */
    update() {
        // Update blockage timer
        this.updateBlock();

        // Gradually decay congestion
        if (this.congestion > 0) {
            this.decreaseCongestion();
        }
    }

    /**
     * Get visual feedback string for debugging
     * @returns {string} Status string
     */
    getStatusString() {
        let status = `Tile(${this.x},${this.y}) [${this.type}]`;

        if (this.isBlocked) {
            status += ` BLOCKED(${this.blockTurnsRemaining}t)`;
        }

        if (this.congestion > 0) {
            status += ` congestion=${this.congestion}/${this.maxCongestion}`;
        }

        if (this.isOccupied()) {
            status += ` occupied(agent=${this.occupiedBy})`;
        }

        return status;
    }

    /**
     * Serialize tile for network transmission or logging
     * @returns {Object} Serialized tile data
     */
    serialize() {
        return {
            x: this.x,
            y: this.y,
            type: this.type,
            isWalkable: this.isWalkable,
            connections: this.connections.length,
            congestion: this.congestion,
            isBlocked: this.isBlocked,
            blockTurnsRemaining: this.blockTurnsRemaining,
            blockType: this.blockType,
            occupiedBy: this.occupiedBy,
            height: this.height,
            color: '0x' + this.color.toString(16).padStart(6, '0'),
        };
    }
}

// Expose to browser global scope when available
if (typeof window !== 'undefined') {
    window.Tile = Tile;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Tile;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Tile;
}
