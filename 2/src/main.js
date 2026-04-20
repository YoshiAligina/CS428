/**
 * main.js - Main game orchestration and entry point
 * 
 * The Game class ties together all systems:
 * - Board generation
 * - Agent spawning and management
 * - Turn-based gameplay (TurnManager)
 * - 3D rendering (Renderer)
 * - User input (InputManager)
 * - UI updates (UIController)
 */

/**
 * Get global constants with fallback values
 * @returns {Object} Game constants
 */
function getGameConstants() {
    return (typeof window !== 'undefined' && window.GAME_CONSTANTS)
        ? window.GAME_CONSTANTS
        : {
            GRID_SIZE: 16,
            TURN_LIMIT: 18,
        };
}

class Game {
    /**
     * Create Game instance
     * @param {number} playerCount - Number of human players (1-4)
     * @param {Array} playerNames - Array of player names (defaults to P1-P4)
     */
    constructor(playerCount = 1, playerNames = []) {
        const constants = getGameConstants();
        // Core game objects
        this.board = null;
        this.agents = [];
        this.turnManager = null;
        this.renderer = null;
        this.inputManager = null;
        this.uiController = null;

        // Game configuration
        this.config = {
            boardWidth: constants.GRID_SIZE,
            boardHeight: constants.GRID_SIZE,
            numAgents: Math.max(1, Math.min(4, playerCount)), // Clamp between 1-4
            minNpcAgents: 3,
            maxNpcAgents: 4,
            maxTurns: constants.TURN_LIMIT,
            agentColors: ['#4da6ff', '#51cf66', '#ff6b6b', '#ffd166'], // 4 player colors
            npcColors: ['#ff8c42', '#ffd166', '#8ecae6', '#c77dff'],
        };

        // Multiplayer state
        this.currentPlayerIndex = 0;

        // Store player names, defaulting to P1-P4 if not provided
        this.playerNames = playerNames.length > 0 ? playerNames :
            Array.from({ length: this.config.numAgents }, (_, i) => `P${i + 1}`);

        // State
        this.isRunning = false;
        this.animationFrameId = null;
        this.keydownListener = null;
        this.keyupListener = null;
        this.pressedKeys = new Set();

    }

    /**
     * Initialize and start the game
     * This is the main entry point
     */
    async start() {
        try {
            // Step 1: Generate board
            this.generateBoard();

            // Step 2: Spawn agents
            this.spawnAgents();

            // Step 3: Initialize TurnManager
            this.initializeTurnManager();

            // Step 4: Initialize Renderer
            this.initializeRenderer();

            // Step 5: Initialize DebugMode
            this.initializeDebugMode();

            // Step 6: Initialize InputManager
            this.initializeInputManager();

            // Step 7: Initialize UIController
            this.initializeUIController();

            // Step 8: Set up event integration
            this.setupEventIntegration();

            // Step 9: Start game systems
            this.startGameSystems();

            // Step 9.1: Assign initial special agent
            if (this.turnManager && this.turnManager.rotateSpecialAgent) {
                this.turnManager.rotateSpecialAgent();
            }

            if (this.uiController && this.uiController.updateAgentList) {
                this.uiController.updateAgentList();
            }
            if (this.uiController && this.uiController.updateSpecialAgentStatus) {
                this.uiController.updateSpecialAgentStatus();
            }

            const player = this.agents[0];
            if (player) {
                this.setMovementDebug(`Ready at (${player.currentLocation.x}, ${player.currentLocation.y})`);
            }

            // Step 10: Begin animation loop
            this.startAnimationLoop();

        } catch (error) {
            console.error('Failed to start game:', error);
            throw error;
        }
    }

    /**
     * Generate the game board
     */
    generateBoard() {
        this.board = new Board(this.config.boardWidth, this.config.boardHeight);
        const generated = this.board.generate();

        if (!generated) {
            throw new Error('Board generation failed');
        }
    }

    /**
     * Spawn agents with random home/job locations
     */
    spawnAgents() {
        const homes = this.board.specialLocations.homes;
        const offices = this.board.specialLocations.offices;

        if (homes.length === 0 || offices.length === 0) {
            throw new Error('No HOME or OFFICE locations available on board');
        }

        this.agents = [];

        // Spawn human players (1-4)
        for (let i = 0; i < this.config.numAgents; i++) {
            const home = homes[i % homes.length];
            const office = offices[i % offices.length];
            const player = new Agent(
                `player_${i + 1}`,
                { x: home.x, y: home.y },
                { x: office.x, y: office.y },
                this.config.agentColors[i],
                this.board
            );

            player.isPlayerControlled = true;
            player.name = this.playerNames[i] || `P${i + 1}`;
            player.plannedPath = [];
            player.pathIndex = 0;
            player.maxTurns = this.config.maxTurns;
            player.turnsRemaining = this.config.maxTurns;
            this.agents.push(player);
        }

        // Spawn 3-4 commuter NPCs
        const npcCount = this.config.minNpcAgents + Math.floor(Math.random() * (this.config.maxNpcAgents - this.config.minNpcAgents + 1));
        for (let index = 0; index < npcCount; index++) {
            const home = homes[(this.config.numAgents + index) % homes.length];
            const office = offices[(this.config.numAgents + index) % offices.length];
            const color = this.config.npcColors[index % this.config.npcColors.length];

            const npc = new Agent(
                `npc_${index + 1}`,
                { x: home.x, y: home.y },
                { x: office.x, y: office.y },
                color,
                this.board
            );

            const waypoint = this.pickNpcWaypoint(home, office);
            npc.isNpc = true;
            npc.isCommuter = true;
            npc.name = `Commuter ${index + 1}`;
            npc.commuterStops = [
                { x: home.x, y: home.y },
                { x: waypoint.x, y: waypoint.y },
                { x: office.x, y: office.y },
            ];
            npc.commuterTargetIndex = 1;
            npc.plannedPath = [];
            npc.pathIndex = 0;
            npc.maxTurns = Number.MAX_SAFE_INTEGER;
            npc.turnsRemaining = Number.MAX_SAFE_INTEGER;

            this.agents.push(npc);
        }

    }

    /**
     * Pick a repeatable commute waypoint for NPC between home and office
     * @param {{x:number,y:number}} home
     * @param {{x:number,y:number}} office
     * @returns {{x:number,y:number}}
     */
    pickNpcWaypoint(home, office) {
        const roadCandidates = Array.from(this.board.roadTiles || []).map((key) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        }).filter((pos) => {
            const isHome = pos.x === home.x && pos.y === home.y;
            const isOffice = pos.x === office.x && pos.y === office.y;
            return !isHome && !isOffice;
        });

        if (roadCandidates.length === 0) {
            return { x: office.x, y: office.y };
        }

        return roadCandidates[Math.floor(Math.random() * roadCandidates.length)];
    }

    /**
     * Get the currently active human player
     * @returns {Agent|null} The active player agent
     */
    getActivePlayer() {
        const players = this.agents.filter(a => a.isPlayerControlled);
        const activePlayers = players.filter(a => a.status === Agent.STATUS.ACTIVE);
        if (activePlayers.length === 0) {
            return players.length > 0 ? players[0] : null;
        }
        return activePlayers[this.currentPlayerIndex % activePlayers.length];
    }

    /**
     * Advance to the next active player or execute NPC turns
     * When all human players have moved, executes NPC turn
     */
    advanceActivePlayer() {
        const activePlayers = this.agents.filter(a => a.isPlayerControlled && a.status === Agent.STATUS.ACTIVE);
        this.currentPlayerIndex++;

        if (this.currentPlayerIndex >= activePlayers.length) {
            // All players have moved, now NPCs move
            this.currentPlayerIndex = 0;
            this.turnManager.executeTurn();
            this.refreshAfterPlayerTurn();
        } else {
            // Just switch active player — update UI and objective highlights only
            if (this.renderer) {
                this.renderer.updateAgents(this.agents, this.getActivePlayer());
                this.renderer.updateTraffic(this.board);
            }
            if (this.uiController) {
                this.uiController.updateAgentList();
                this.uiController.updateTurnDisplay();
            }
        }
    }

    /**
     * Initialize TurnManager
     */
    initializeTurnManager() {
        this.turnManager = new TurnManager(
            this.agents,
            this.board,
            { maxTurns: this.config.maxTurns }
        );

    }

    /**
     * Initialize 3D Renderer
     */
    initializeRenderer() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            throw new Error('Canvas element #gameCanvas not found');
        }

        this.renderer = new Renderer(canvas, this.board, this.agents);

        // Make renderer globally available for UIController
        window.gameRenderer = this.renderer;

    }

    /**
     * Initialize DebugMode for development visualization
     */
    initializeDebugMode() {
        this.debugMode = new DebugMode(this.renderer, this.board, this.agents);
        
        // Make globally available for debugging
        window.gameDebugMode = this.debugMode;

    }

    /**
     * Initialize InputManager for mouse/keyboard input
     */
    initializeInputManager() {
        this.inputManager = new InputManager(this.renderer, this.board, this.debugMode || null);
        
        // Make globally available for UIController
        window.gameInputManager = this.inputManager;

    }

    /**
     * Initialize UIController for HTML UI updates
     */
    initializeUIController() {
        this.uiController = new UIController(
            this.turnManager,
            this.board,
            this.agents
        );
        this.uiController.init();

    }

    /**
     * Set up event integration between systems
     */
    setupEventIntegration() {
        // InputManager → UIController (tile clicks)
        this.inputManager.on('tileClick', (data) => {
            this.handleTileClick(data.x, data.y);
        });

        // InputManager → Console logging (hover feedback)
        this.inputManager.on('tileHover', (data) => {
            // Optional: could update UI with hover info
        });

        // Global keyboard fallback to ensure movement works even if other handlers intercept keys
        if (!this.keydownListener) {
            this.keydownListener = (event) => {
                const key = this.normalizeMovementKey(event);
                if (key) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.repeat === true || this.pressedKeys.has(key)) {
                        return;
                    }
                    this.pressedKeys.add(key);
                    this.handlePlayerMovementInput(key);
                }
            };
            window.addEventListener('keydown', this.keydownListener, { capture: true, passive: false });
        }

        if (!this.keyupListener) {
            this.keyupListener = (event) => {
                const key = this.normalizeMovementKey(event);
                if (key) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.pressedKeys.delete(key);
                }
            };
            window.addEventListener('keyup', this.keyupListener, { capture: true, passive: false });
        }

        // TurnManager → UI updates (turn events)
        this.turnManager.on('turnExecuted', (data) => {
        });

        this.turnManager.on('gameFinished', (data) => {
        });

    }

    /**
     * Start game systems (TurnManager, etc.)
     */
    startGameSystems() {
        // Start the turn manager (initializes paths)
        this.uiController.startGame();
        this.isRunning = true;

    }

    /**
     * Start animation loop
     */
    startAnimationLoop() {
        const animate = () => {
            this.animationFrameId = requestAnimationFrame(animate);
            this.update();
        };

        animate();
    }

    /**
     * Update loop - called every frame
     */
    update() {
        if (!this.isRunning) return;

        // Update input manager (hover detection)
        if (this.inputManager && this.inputManager.update) {
            this.inputManager.update();
        }

        // Update debug mode visualizations
        if (this.debugMode) {
            this.debugMode.render();
        }

        // Render the scene
        if (this.renderer) {
            this.renderer.render();
        }
    }

    /**
     * Normalize keyboard event into movement key token
     * @param {KeyboardEvent} event
     * @returns {string|null}
     */
    normalizeMovementKey(event) {
        const key = (event.key || '').toLowerCase();
        const keyCode = typeof event.keyCode === 'number' ? event.keyCode : null;

        if (key === 'arrowup' || keyCode === 38) return 'arrowup';
        if (key === 'arrowdown' || keyCode === 40) return 'arrowdown';
        if (key === 'arrowleft' || keyCode === 37) return 'arrowleft';
        if (key === 'arrowright' || keyCode === 39) return 'arrowright';
        if (key === 'w' || keyCode === 87) return 'w';
        if (key === 'a' || keyCode === 65) return 'a';
        if (key === 's' || keyCode === 83) return 's';
        if (key === 'd' || keyCode === 68) return 'd';

        return null;
    }

    /**
     * Update movement debug status in UI
     * @param {string} message
     */
    setMovementDebug(message) {
        const debugElement = document.getElementById('moveDebug');
        if (debugElement) {
            debugElement.textContent = `Move debug: ${message}`;
        }
    }

    /**
     * Handle end turn action
     * Called by UIController when "End Turn" button is clicked
     */
    handleEndTurn() {
        if (!this.turnManager.gameRunning || this.turnManager.gameFinished) {
            return;
        }


        // Execute turn
        this.turnManager.executeTurn();

        // Update renderer
        if (this.renderer) {
            this.renderer.updateAgents(this.agents);
            // this.renderer.updateAgentPaths(this.agents);  // Disabled: Hide NPC path visualization
            this.renderer.updateTraffic(this.board);
        }

        // Update UI
        if (this.uiController) {
            this.uiController.updateTurnDisplay();
            this.uiController.updateAgentList();
            this.uiController.updateTaskChecklist();
            this.uiController.updateStatistics();
            this.uiController.updateTurnTimeline();

            // Check if game is over
            if (this.turnManager.gameFinished) {
                this.uiController.updateGameStatus('gameover');
                this.uiController.showGameOver();
            } else {
                this.uiController.updateGameStatus('playing');
            }
        }
    }

    /**
     * Handle tile click
     * @param {number} x - Tile x coordinate
     * @param {number} y - Tile y coordinate
     */
    handleTileClick(x, y) {

        // Check if roadblock mode is active
        if (this.uiController && this.uiController.isRoadblockMode()) {
            // Place or remove roadblock
            this.uiController.placeRoadblock(x, y);
        } else {
            // Show tile inspector
            if (this.uiController) {
                this.uiController.updateTileInspector(x, y);
            }
        }
    }

    /**
     * Handle keyboard movement input for the player
     * @param {string} key - Keyboard key
     */
    handlePlayerMovementInput(key) {
        const movementMap = {
            w: { dx: 0, dy: -1 },
            a: { dx: -1, dy: 0 },
            s: { dx: 0, dy: 1 },
            d: { dx: 1, dy: 0 },
            arrowup: { dx: 0, dy: -1 },
            arrowleft: { dx: -1, dy: 0 },
            arrowdown: { dx: 0, dy: 1 },
            arrowright: { dx: 1, dy: 0 },
        };

        const normalizedKey = (key || '').toLowerCase();
        const move = movementMap[normalizedKey];

        if (!move) return;

        this.movePlayer(move.dx, move.dy);
    }

    /**
     * Check if a tile can be entered by player movement rules
     * Buildings/special buildings are only enterable when they are required destinations.
     * @param {Agent} player
     * @param {Tile} tile
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    canPlayerEnterTile(player, tile, x, y) {
        if (!tile || tile.isBlocked) {
            return false;
        }

        const alwaysWalkableTypes = new Set(['ROAD', 'INTERSECTION', 'LANDMARK']);
        if (alwaysWalkableTypes.has(tile.type)) {
            return true;
        }

        if (tile.type === 'HOSPITAL' && player.mustVisitHospital) {
            return true;
        }

        if (tile.type === 'JAIL' && player.mustVisitJail) {
            return true;
        }

        const destinationKeys = new Set();

        if (player.homeLocation) {
            destinationKeys.add(`${player.homeLocation.x},${player.homeLocation.y}`);
        }

        if (player.jobLocation) {
            destinationKeys.add(`${player.jobLocation.x},${player.jobLocation.y}`);
        }

        if (player.hospitalTaskLocation) {
            destinationKeys.add(`${player.hospitalTaskLocation.x},${player.hospitalTaskLocation.y}`);
        }

        if (player.jailTaskLocation) {
            destinationKeys.add(`${player.jailTaskLocation.x},${player.jailTaskLocation.y}`);
        }

        if (Array.isArray(player.tasksQueue)) {
            for (const task of player.tasksQueue) {
                if (!task.completed && task.location) {
                    destinationKeys.add(`${task.location.x},${task.location.y}`);
                }
            }
        }

        return destinationKeys.has(`${x},${y}`);
    }

    /**
     * Move player one tile if valid and advance turn state
     * @param {number} dx - Delta x
     * @param {number} dy - Delta y
     */
    movePlayer(dx, dy) {
        if (!this.turnManager || this.turnManager.gameFinished) {
            this.setMovementDebug('Blocked: game finished or unavailable');
            return false;
        }

        const player = this.getActivePlayer();
        if (!player || player.status !== Agent.STATUS.ACTIVE) {
            this.setMovementDebug(`Blocked: player status is ${player ? player.status : 'missing'}`);
            return false;
        }

        const currentTile = this.board.getTile(player.currentLocation.x, player.currentLocation.y);
        const isAtJailLocation = currentTile && currentTile.type === 'JAIL';
        if (!player.isInJail && player.mustVisitJail && isAtJailLocation && player.jailSentence > 0) {
            player.isInJail = true;
        }

        if (player.isInJail && player.jailSentence > 0) {
            player.serveJailTime();
            player.decrementTurns();
            this.advanceActivePlayer();

            if (player.jailSentence > 0) {
                this.setMovementDebug(`In jail: ${player.jailSentence} turn(s) remaining | Turn ${this.turnManager.currentTurn}`);
            } else {
                this.setMovementDebug(`Released from jail | Turn ${this.turnManager.currentTurn}`);
            }
            return false;
        }

        if (player.healingTurnsRemaining && player.healingTurnsRemaining > 0) {
            player.healingTurnsRemaining--;
            if (player.healingTurnsRemaining === 0) {
                player.recalculatePath(this.board);
            }

            player.decrementTurns();
            this.advanceActivePlayer();

            if (player.healingTurnsRemaining > 0) {
                this.setMovementDebug(`Recovering in hospital: ${player.healingTurnsRemaining} turn(s) remaining | Turn ${this.turnManager.currentTurn}`);
            } else {
                this.setMovementDebug(`Recovered from hospital stay | Turn ${this.turnManager.currentTurn}`);
            }
            return false;
        }

        const targetX = player.currentLocation.x + dx;
        const targetY = player.currentLocation.y + dy;
        if (targetX < 0 || targetY < 0 || targetX >= this.board.width || targetY >= this.board.height) {
            this.setMovementDebug(`Blocked: out of bounds (${targetX}, ${targetY})`);
            return false;
        }

        const targetTile = this.board.getTile(targetX, targetY);
        if (!this.canPlayerEnterTile(player, targetTile, targetX, targetY)) {
            this.setMovementDebug(`Blocked: tile unavailable at (${targetX}, ${targetY})`);
            return false;
        }

        player.currentLocation = { x: targetX, y: targetY };
        player.plannedPath = [];
        player.pathIndex = 0;
        player.movementHistory.push({
            turn: player.turnsElapsed,
            position: { ...player.currentLocation },
        });

        if (targetTile.increaseCongestion) {
            targetTile.increaseCongestion();
        }

        const playerMesh = this.renderer && this.renderer.agentMeshes
            ? this.renderer.agentMeshes.get(player.id.toString())
            : null;
        if (playerMesh) {
            playerMesh.position.set(player.currentLocation.x, 0.5, player.currentLocation.y);
        }

        player.checkArrival(this.board);

        if (player.isInJail && player.jailSentence > 0) {
            player.serveJailTime();
            if (player.jailSentence === 0) {
                player.recalculatePath(this.board);
            }
        }

        player.decrementTurns();

        this.advanceActivePlayer();

        this.setMovementDebug(`Moved to (${targetX}, ${targetY}) | Turn ${this.turnManager.currentTurn}`);
        return true;
    }

    /**
     * Refresh renderer and UI after a player turn advances
     */
    refreshAfterPlayerTurn() {

        if (this.renderer) {
            this.renderer.updateAgents(this.agents, this.getActivePlayer());
            // this.renderer.updateAgentPaths(this.agents);  // Disabled: Hide NPC path visualization
            this.renderer.updateTraffic(this.board);
        }

        if (this.uiController) {
            this.uiController.updateTurnDisplay();
            this.uiController.updateAgentList();
            this.uiController.updateTaskChecklist();
            this.uiController.updateStatistics();
            this.uiController.updateTurnTimeline();

            if (this.turnManager.gameFinished) {
                this.uiController.updateGameStatus('gameover');
                this.uiController.showGameOver();
            } else {
                this.uiController.updateGameStatus('playing');
            }
        }
    }

    /**
     * Reset game
     */
    reset() {

        if (this.keydownListener) {
            window.removeEventListener('keydown', this.keydownListener, { capture: true });
            this.keydownListener = null;
        }

        if (this.keyupListener) {
            window.removeEventListener('keyup', this.keyupListener, { capture: true });
            this.keyupListener = null;
        }

        this.pressedKeys.clear();

        // Stop animation loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Clear renderer
        if (this.renderer && this.renderer.dispose) {
            this.renderer.dispose();
        }

        // Reset state
        this.board = null;
        this.agents = [];
        this.turnManager = null;
        this.renderer = null;
        this.inputManager = null;
        this.uiController = null;
        this.isRunning = false;

        // Restart game
        this.start();
    }

    /**
     * Pause game
     */
    pause() {
        this.isRunning = false;
    }

    /**
     * Resume game
     */
    resume() {
        this.isRunning = true;
    }

    /**
     * Get current game state
     * @returns {Object} Current game state
     */
    getState() {
        return {
            turn: this.turnManager?.currentTurn || 0,
            maxTurns: this.config.maxTurns,
            gameRunning: this.turnManager?.gameRunning || false,
            gameFinished: this.turnManager?.gameFinished || false,
            agents: this.agents.map((agent, i) => ({
                index: i + 1,
                id: agent.id,
                status: agent.status,
                location: agent.currentLocation,
                turnsRemaining: agent.turnsRemaining,
                color: agent.color
            })),
            board: {
                width: this.board?.width || 0,
                height: this.board?.height || 0,
                roads: this.board?.roadTiles?.size || 0
            }
        };
    }
}

/**
 * Entry point - Initialize game when page loads
 */
let game = null;

function hideStartMenu() {
    const startMenu = document.getElementById('startMenu');
    if (startMenu) {
        startMenu.classList.add('hidden');
    }
}

function initializeAndStartGame() {
    if (typeof THREE === 'undefined') {
        console.error('Three.js failed to load');
        alert('Error: Three.js library failed to load. Please refresh the page.');
        return false;
    }

    const requiredClasses = ['Board', 'Agent', 'Renderer', 'InputManager', 'TurnManager', 'UIController', 'Utils', 'Tile'];
    const missingClasses = requiredClasses.filter(className => typeof window[className] === 'undefined');

    if (missingClasses.length > 0) {
        console.error('Missing required classes:', missingClasses);
        alert(`Error: Failed to load required game classes: ${missingClasses.join(', ')}`);
        return false;
    }

    try {
        // Read selected player count from DOM
        const selectedCount = (() => {
            const btn = document.querySelector('.player-count-btn.selected');
            return btn ? parseInt(btn.dataset.count, 10) : 1;
        })();

        // Apply map size + difficulty selections to GAME_CONSTANTS before Board generates
        const mapSize = document.querySelector('[data-map-size].selected')?.dataset.mapSize || 'medium';
        const difficulty = document.querySelector('[data-difficulty].selected')?.dataset.difficulty || 'normal';
        if (typeof window.applyGameSettings === 'function') {
            window.applyGameSettings({ mapSize, difficulty });
        }

        // Capture the selected visual theme so the Renderer can style buildings to match
        const themeBtn = document.querySelector('[data-theme].selected');
        window.GAME_THEME = (themeBtn && themeBtn.dataset.theme) || 'classic';

        // Read player names from input fields
        const playerNames = [];
        for (let i = 0; i < selectedCount; i++) {
            const nameInput = document.getElementById(`playerName${i + 1}`);
            const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `P${i + 1}`;
            playerNames.push(name);
        }

        game = new Game(selectedCount, playerNames);
        game.start();
        window.game = game;
        return true;
    } catch (error) {
        console.error('Failed to initialize game:', error);
        alert(`Error: Failed to start game: ${error.message}`);
        return false;
    }
}

window.addEventListener('load', () => {
    const startButton = document.getElementById('startGameBtn');

    if (!startButton) {
        console.error('Start button #startGameBtn not found');
        const started = initializeAndStartGame();
        if (started) {
            hideStartMenu();
        }
        return;
    }

    startButton.addEventListener('click', () => {
        startButton.disabled = true;

        // Wait briefly for all scripts/libraries to be fully available
        setTimeout(() => {
            const started = initializeAndStartGame();
            if (started) {
                hideStartMenu();
            } else {
                startButton.disabled = false;
            }
        }, 200);
    });
});

/**
 * Handle window resize
 */
window.addEventListener('resize', () => {
    if (game && game.renderer && game.renderer.onWindowResize) {
        game.renderer.onWindowResize();
    }
});

/**
 * Handle page visibility change (pause when tab is hidden)
 */
document.addEventListener('visibilitychange', () => {
    if (game) {
        if (document.hidden) {
            game.pause();
        } else {
            game.resume();
        }
    }
});
