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
            numAgents: 4,
            maxTurns: constants.TURN_LIMIT,
            agentColors: ['#ff6b6b', '#51cf66', '#4da6ff', '#ffd43b'],
        };

        // State
        this.isRunning = false;
        this.animationFrameId = null;

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

        for (let i = 0; i < this.config.numAgents; i++) {
            // Use modulo to allow reusing locations if needed
            const home = homes[i % homes.length];
            const office = offices[i % offices.length];
            const color = this.config.agentColors[i % this.config.agentColors.length];

            const agent = new Agent(
                `agent_${i + 1}`,
                { x: home.x, y: home.y },
                { x: office.x, y: office.y },
                color,
                this.board  // Pass board for initial pathfinding
            );

            // Set max turns
            agent.maxTurns = this.config.maxTurns;
            agent.turnsRemaining = this.config.maxTurns;

            this.agents.push(agent);
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
        this.renderer.init();
        this.renderer.createBoard(this.board);
        this.renderer.createAgents(this.agents);

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
        this.inputManager.init();
        
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
     * Reset game
     */
    reset() {

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
