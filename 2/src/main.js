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
     */
    constructor() {
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
            numAgents: 1,
            minNpcAgents: 3,
            maxNpcAgents: 4,
            maxTurns: constants.TURN_LIMIT,
            agentColors: ['#4da6ff'],
            npcColors: ['#ff8c42', '#ffd166', '#8ecae6', '#c77dff'],
        };

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

        // Spawn player
        const playerHome = homes[0];
        const playerOffice = offices[0];
        const player = new Agent(
            'player_1',
            { x: playerHome.x, y: playerHome.y },
            { x: playerOffice.x, y: playerOffice.y },
            this.config.agentColors[0],
            this.board
        );

        player.isPlayerControlled = true;
        player.name = 'Player';
        player.plannedPath = [];
        player.pathIndex = 0;
        player.maxTurns = this.config.maxTurns;
        player.turnsRemaining = this.config.maxTurns;
        this.agents.push(player);

        // Spawn 3-4 commuter NPCs
        const npcCount = this.config.minNpcAgents + Math.floor(Math.random() * (this.config.maxNpcAgents - this.config.minNpcAgents + 1));
        for (let index = 0; index < npcCount; index++) {
            const home = homes[(index + 1) % homes.length];
            const office = offices[(index + 1) % offices.length];
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
            this.renderer.updateAgentPaths(this.agents);
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
     * Move player one tile if valid and advance turn state
     * @param {number} dx - Delta x
     * @param {number} dy - Delta y
     */
    movePlayer(dx, dy) {
        if (!this.turnManager || this.turnManager.gameFinished) {
            this.setMovementDebug('Blocked: game finished or unavailable');
            return false;
        }

        const player = this.agents[0];
        if (!player || player.status !== Agent.STATUS.ACTIVE) {
            this.setMovementDebug(`Blocked: player status is ${player ? player.status : 'missing'}`);
            return false;
        }

        const isAtJailLocation = player.jailTaskLocation &&
            player.currentLocation.x === player.jailTaskLocation.x &&
            player.currentLocation.y === player.jailTaskLocation.y;
        if (!player.isInJail && player.mustVisitJail && isAtJailLocation && player.jailSentence > 0) {
            player.isInJail = true;
        }

        if (player.isInJail && player.jailSentence > 0) {
            player.serveJailTime();
            player.decrementTurns();
            this.turnManager.executeTurn();
            this.refreshAfterPlayerTurn();

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
            this.turnManager.executeTurn();
            this.refreshAfterPlayerTurn();

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
        const isIntersection = targetTile && targetTile.type === Tile.TYPES.INTERSECTION;
        if (!targetTile || targetTile.isBlocked) {
            this.setMovementDebug(`Blocked: tile unavailable at (${targetX}, ${targetY})`);
            return false;
        }

        // --- new walkability enforcement ---------------------------------
        const currentTile = this.board.getTile(player.currentLocation.x, player.currentLocation.y);
        const currentIsRoad = currentTile &&
            (currentTile.type === Tile.TYPES.ROAD || currentTile.type === Tile.TYPES.INTERSECTION);

        // intersections are treated as always walkable even if the flag is wrong
        if (!isIntersection && !targetTile.isWalkable) {
            this.setMovementDebug(`Blocked: target tile is non-walkable type ${targetTile.type}`);
            return false;
        }

        const buildingTypes = [
            Tile.TYPES.HOME,
            Tile.TYPES.OFFICE,
            Tile.TYPES.CAFE,
            Tile.TYPES.LANDMARK,
            Tile.TYPES.HOSPITAL,
            Tile.TYPES.JAIL,
        ];
        const isTargetBuilding = buildingTypes.includes(targetTile.type);

        const nextDest = player.getNextDestination ? player.getNextDestination() : null;
        const isDestination = nextDest && nextDest.x === targetX && nextDest.y === targetY;

        if (isTargetBuilding) {
            // manual movement: allow entry whenever approaching from a road/intersection
            // regardless of destination.  This makes buildings reachable by player
            // navigation while still preventing direct building→building moves.
            if (!currentIsRoad) {
                this.setMovementDebug('Blocked: must approach building from road or intersection');
                return false;
            }
        }

        // ------------------------------------------------------------------

        player.currentLocation = { x: targetX, y: targetY };
        player.plannedPath = [];
        player.pathIndex = 0;

        // debug note: report if stepping onto an intersection
        if (isIntersection) {
            this.setMovementDebug(`Moved onto intersection at (${targetX}, ${targetY}) | Turn ${this.turnManager.currentTurn}`);
        }
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

        this.turnManager.executeTurn();

        this.refreshAfterPlayerTurn();

        this.setMovementDebug(`Moved to (${targetX}, ${targetY}) | Turn ${this.turnManager.currentTurn}`);
        return true;
    }

    /**
     * Refresh renderer and UI after a player turn advances
     */
    refreshAfterPlayerTurn() {

        if (this.renderer) {
            this.renderer.updateAgents(this.agents);
            this.renderer.updateAgentPaths(this.agents);
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

window.addEventListener('load', () => {

    // Wait for Three.js to load
    setTimeout(() => {
        if (typeof THREE === 'undefined') {
            console.error('Three.js failed to load');
            alert('Error: Three.js library failed to load. Please refresh the page.');
            return;
        }

        // Check if all required classes are loaded
        const requiredClasses = ['Board', 'Agent', 'Renderer', 'InputManager', 'TurnManager', 'UIController', 'Utils', 'Tile'];
        const missingClasses = requiredClasses.filter(className => typeof window[className] === 'undefined');

        if (missingClasses.length > 0) {
            console.error('Missing required classes:', missingClasses);
            alert(`Error: Failed to load required game classes: ${missingClasses.join(', ')}`);
            return;
        }


        try {
            // Create and start game
            game = new Game();
            game.start();

            // Make game accessible from console for debugging
            window.game = game;

        } catch (error) {
            console.error('Failed to initialize game:', error);
            alert(`Error: Failed to start game: ${error.message}`);
        }
    }, 200);
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
