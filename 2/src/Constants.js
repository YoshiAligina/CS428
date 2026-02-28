/**
 * Constants.js - Global configuration constants for the game
 */

/**
 * @typedef {Object} GameConstants
 * @property {number} GRID_SIZE - Default board width/height
 * @property {number} TURN_LIMIT - Max turns allowed
 * @property {number} ACCIDENT_PROBABILITY - Accident chance per turn
 * @property {number} ACCIDENT_BLOCK_TURNS - Turns an accident blocks a tile
 * @property {number} CONGESTION_THRESHOLD - Congestion threshold for slowdown
 * @property {number} CONGESTION_SLOW_CHANCE - Chance to slow on congested tiles
 * @property {number} PLAYER_BLOCK_DURATION - Turns a player roadblock lasts
 * @property {number} ROAD_RANDOM_DENSITY - Random road density in generation
 * @property {number} ROAD_ADJACENT_CHANCE - Chance to add adjacent road in generation
 */

/** @type {GameConstants} */
const GAME_CONSTANTS = {
    GRID_SIZE: 16,
    TURN_LIMIT: 50,
    ACCIDENT_PROBABILITY: 0.03,
    ACCIDENT_BLOCK_TURNS: 3,
    CONGESTION_THRESHOLD: 4,
    CONGESTION_SLOW_CHANCE: 0.5,
    PLAYER_BLOCK_DURATION: 5,
    ROAD_RANDOM_DENSITY: 0.15,
    ROAD_ADJACENT_CHANCE: 0.4,
};

if (typeof window !== 'undefined') {
    window.GAME_CONSTANTS = GAME_CONSTANTS;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GAME_CONSTANTS;
}
