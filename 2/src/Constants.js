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

const MAP_SIZE_PRESETS = {
    small:  { GRID_SIZE: 12, TURN_LIMIT: 40 },
    medium: { GRID_SIZE: 16, TURN_LIMIT: 50 },
    large:  { GRID_SIZE: 22, TURN_LIMIT: 70 },
};

const DIFFICULTY_PRESETS = {
    easy:   { ACCIDENT_PROBABILITY: 0.015, ACCIDENT_BLOCK_TURNS: 2, CONGESTION_THRESHOLD: 6, CONGESTION_SLOW_CHANCE: 0.3 },
    normal: { ACCIDENT_PROBABILITY: 0.03,  ACCIDENT_BLOCK_TURNS: 3, CONGESTION_THRESHOLD: 4, CONGESTION_SLOW_CHANCE: 0.5 },
    hard:   { ACCIDENT_PROBABILITY: 0.05,  ACCIDENT_BLOCK_TURNS: 4, CONGESTION_THRESHOLD: 3, CONGESTION_SLOW_CHANCE: 0.7 },
};

function applyGameSettings({ mapSize, difficulty } = {}) {
    const map = MAP_SIZE_PRESETS[mapSize] || MAP_SIZE_PRESETS.medium;
    const diff = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.normal;
    Object.assign(GAME_CONSTANTS, map, diff);
}

if (typeof window !== 'undefined') {
    window.GAME_CONSTANTS = GAME_CONSTANTS;
    window.MAP_SIZE_PRESETS = MAP_SIZE_PRESETS;
    window.DIFFICULTY_PRESETS = DIFFICULTY_PRESETS;
    window.applyGameSettings = applyGameSettings;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GAME_CONSTANTS, MAP_SIZE_PRESETS, DIFFICULTY_PRESETS, applyGameSettings };
}
