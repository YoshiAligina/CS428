/**
 * TurnManager.js - Turn-based game loop and turn resolution
 */

/**
 * Get turn manager constants with fallback values
 * @returns {Object} Turn manager constants
 */
function getTurnConstants() {
    return (typeof window !== 'undefined' && window.GAME_CONSTANTS)
        ? window.GAME_CONSTANTS
        : {
            TURN_LIMIT: 18,
            ACCIDENT_PROBABILITY: 0.03,
            ACCIDENT_BLOCK_TURNS: 3,
            CONGESTION_THRESHOLD: 4,
            CONGESTION_SLOW_CHANCE: 0.5,
            PLAYER_BLOCK_DURATION: 5,
        };
}

class TurnManager {
    /**
     * Create a TurnManager
     * @param {Array} agents - Agents in the game
     * @param {Board} board - Board instance
     * @param {Object} config - TurnManager configuration
     */
    constructor(agents, board, config = {}) {
        const constants = getTurnConstants();

        this.agents = agents;
        this.board = board;
        this.config = {
            maxTurns: constants.TURN_LIMIT,
            accidentProbability: constants.ACCIDENT_PROBABILITY,
            accidentBlockTurns: constants.ACCIDENT_BLOCK_TURNS,
            congestionThreshold: constants.CONGESTION_THRESHOLD,
            congestionSlowChance: constants.CONGESTION_SLOW_CHANCE,
            playerBlockDuration: constants.PLAYER_BLOCK_DURATION,
            ...config,
        };

        this.currentTurn = 0;
        this.gameRunning = false;
        this.gameFinished = false;
        this.callbacks = {};
        this.playerBlockUsed = false;
        this.playerBlocks = new Map();

        // Special agent rotation
        this.currentSpecialAgent = null;
        this.turnsUntilNextRotation = 2;

        this.assignRandomTasks();
    }

    /**
     * Register callback for turn events
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    /**
     * Place a player roadblock at specified location
     * @param {number} x - Tile x coordinate
     * @param {number} y - Tile y coordinate
     * @returns {boolean} True if block was placed successfully
     */
    placePlayerBlock(x, y) {
        if (this.playerBlockUsed) {
            console.warn('Player has already placed a block this turn');
            return false;
        }

        if (!this.currentSpecialAgent || !this.currentSpecialAgent.canUseAbility()) {
            console.warn('No special agent ability available');
            return false;
        }

        const tile = this.board.getTile(x, y);
        if (!tile) {
            console.warn(`Invalid tile coordinates: (${x}, ${y})`);
            return false;
        }

        if (tile.type === 'BUILDING') {
            console.warn('Cannot place roadblock on buildings');
            return false;
        }

        const used = this.currentSpecialAgent.useAbility(this.board, x, y);
        if (!used) {
            console.warn('Special agent could not use ability on this tile');
            return false;
        }

        this.playerBlockUsed = true;

        const key = `${x},${y}`;
        const duration = tile.blockTurnsRemaining || this.config.playerBlockDuration;
        this.playerBlocks.set(key, {
            x,
            y,
            turnsRemaining: duration,
            placedOnTurn: this.currentTurn,
        });

        for (let agent of this.agents) {
            if (agent.currentLocation.x === x && agent.currentLocation.y === y) {
                agent.calculatePath(this.board);
            } else if (agent.plannedPath.length > 0) {
                const hasBlockInPath = agent.plannedPath.some(pos => pos.x === x && pos.y === y);
                if (hasBlockInPath) {
                    agent.calculatePath(this.board);
                }
            }
        }

        this.emit('playerBlockPlaced', { x, y });
        return true;
    }

    /**
     * Rotate special agent ability to a new random active agent
     */
    rotateSpecialAgent() {
        if (this.currentSpecialAgent) {
            this.currentSpecialAgent.removeAbility();
        }

        const activeAgents = this.agents.filter(agent =>
            agent.status !== Agent.STATUS.FAILED && agent.status !== Agent.STATUS.ARRIVED
        );

        if (activeAgents.length === 0) {
            this.currentSpecialAgent = null;
            this.turnsUntilNextRotation = 2;
            return;
        }

        const index = Math.floor(Math.random() * activeAgents.length);
        const agent = activeAgents[index];

        agent.grantAbility('ROADBLOCK', 1, 2);
        this.currentSpecialAgent = agent;
        this.turnsUntilNextRotation = 2;

        console.log(`Agent ${agent.id} is now the special agent!`);
        this.emit('specialAgentRotated', { agent });
    }

    /**
     * Update special agent rotation countdown
     */
    updateSpecialAgentRotation() {
        this.turnsUntilNextRotation--;

        if (this.turnsUntilNextRotation <= 0) {
            this.rotateSpecialAgent();
        } else {
            this.emit('specialAgentCountdown', { turns: this.turnsUntilNextRotation });
        }
    }

    /**
     * Check if agent is adjacent to an unvisited landmark
     * @param {Agent} agent - Agent to check
     * @returns {Tile|null} Landmark tile if adjacent, null otherwise
     */
    getAdjacentLandmark(agent) {
        if (!this.board || !agent) {
            return null;
        }

        const { x, y } = agent.currentLocation;
        const coordKey = `${x},${y}`;

        // Check 4 cardinal directions (within 1 tile)
        const directions = [
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
        ];

        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            const tile = this.board.getTile(nx, ny);

            if (tile && tile.type === Tile.TYPES.LANDMARK && !agent.visitedLandmarks.has(`${nx},${ny}`)) {
                return tile;
            }
        }

        return null;
    }

    /**
     * Update player blocks (decrease duration)
     */
    updatePlayerBlocks() {
        const blocksToRemove = [];

        this.playerBlocks.forEach((block, key) => {
            block.turnsRemaining--;

            if (block.turnsRemaining <= 0) {
                const tile = this.board.getTile(block.x, block.y);
                if (tile) {
                    tile.isBlocked = false;
                }
                blocksToRemove.push(key);
            }
        });

        blocksToRemove.forEach(key => this.playerBlocks.delete(key));
    }

    /**
     * Assign random tasks to agents
     * 30% chance for each agent to get a CAFE task
     */
    assignRandomTasks() {
        if (!this.board) {
            console.warn('TurnManager: No board provided for task assignment');
            return;
        }

        for (let agent of this.agents) {
            if (agent.isCommuter) continue;

            // 30% chance: grab coffee at a cafe
            if (Math.random() < 0.30) {
                const cafeLocation = this.board.getRandomSpecialLocation('CAFE');
                if (cafeLocation) {
                    agent.addTask('CAFE', cafeLocation);
                }
            }

            // 25% chance: take a photo at a landmark
            if (Math.random() < 0.25) {
                const landmarkLocation = this.board.getRandomSpecialLocation('LANDMARK');
                if (landmarkLocation) {
                    agent.addTask('LANDMARK', landmarkLocation);
                }
            }

            // 12% chance: pick up medicine at a hospital (voluntary; not injury-driven)
            if (Math.random() < 0.12) {
                const hospitalLocation = this.board.getRandomSpecialLocation('HOSPITAL');
                if (hospitalLocation) {
                    agent.addTask('HOSPITAL', hospitalLocation, { subtype: 'MEDICINE' });
                }
            }
        }
    }

    /**
     * Randomly create a road accident (temporary blockage)
     */
    maybeCreateAccident() {
        if (!this.board || !this.config.accidentProbability) {
            return;
        }

        if (Math.random() >= this.config.accidentProbability) {
            return;
        }

        const tile = this.board.getRandomRoadTile(true);
        if (!tile || tile.isBlocked) {
            return;
        }

        tile.blockTile(this.config.accidentBlockTurns, 'accident');
        this.emit('accidentCreated', { x: tile.x, y: tile.y });

        if (typeof window !== 'undefined' && window.gameRenderer && window.gameRenderer.createParticleEffect) {
            window.gameRenderer.createParticleEffect(tile.x, tile.y, 'accident');
        }
    }

    /**
     * Trigger random events (injuries, crimes, etc.)
     */
    triggerRandomEvents() {
        if (!this.board || !this.agents || this.agents.length === 0) {
            return;
        }

        // Track which agent (if any) was hit this turn so we never combo
        // injury + crime on the same person in a single turn.
        let hitThisTurn = null;

        const eligible = (agent) =>
            agent.status !== Agent.STATUS.FAILED &&
            agent.status !== Agent.STATUS.ARRIVED &&
            !agent.isCommuter &&
            !agent.isInjured &&
            !agent.isCriminal &&
            (agent.injuryCooldown || 0) <= 0 &&
            (agent.crimeCooldown || 0) <= 0;

        // Injury event (was 2%, now 0.8%)
        if (Math.random() < 0.008) {
            const candidates = this.agents.filter(a => eligible(a) && a !== hitThisTurn);
            if (candidates.length > 0) {
                const hospitalLocation = this.board.getRandomSpecialLocation('HOSPITAL');
                if (hospitalLocation) {
                    const agent = candidates[Math.floor(Math.random() * candidates.length)];
                    const injured = agent.injure(hospitalLocation);
                    if (injured) {
                        console.log(`Agent ${agent.id} was injured! Must visit hospital.`);
                        if (!agent.isPlayerControlled) {
                            agent.calculatePath(this.board);
                        }
                        hitThisTurn = agent;
                        this.emit('agentInjured', { agent, hospitalLocation });
                    }
                }
            }
        }

        // Crime event (was 1%, now 0.4%)
        if (Math.random() < 0.004) {
            const candidates = this.agents.filter(a => eligible(a) && a !== hitThisTurn);
            if (candidates.length > 0) {
                const jailLocation = this.board.getRandomSpecialLocation('JAIL');
                if (jailLocation) {
                    const agent = candidates[Math.floor(Math.random() * candidates.length)];
                    const committed = agent.commitCrime(jailLocation);
                    if (committed) {
                        console.log(`Agent ${agent.id} committed a crime! Must serve jail time.`);
                        if (!agent.isPlayerControlled) {
                            agent.calculatePath(this.board);
                        }
                        hitThisTurn = agent;
                        this.emit('agentCriminalized', { agent, jailLocation });
                    }
                }
            }
        }
    }

    /**
     * Decrement injury/crime cooldowns each turn so agents become re-eligible
     * for random hospital/jail events after a grace period.
     */
    updateEventCooldowns() {
        for (const agent of this.agents) {
            if ((agent.injuryCooldown || 0) > 0) agent.injuryCooldown--;
            if ((agent.crimeCooldown  || 0) > 0) agent.crimeCooldown--;
        }
    }

    /**
     * Emit event to callbacks
     * @param {string} event - Event name
     * @param {Object} data - Event payload
     */
    emit(event, data) {
        if (this.callbacks[event]) {
            for (let callback of this.callbacks[event]) {
                callback(data);
            }
        }
    }

    /**
     * Start the game
     */
    start() {
        this.currentTurn = 0;
        this.gameRunning = true;
        this.gameFinished = false;
        this.turnsUntilNextRotation = 2;
        if (this.currentSpecialAgent) {
            this.currentSpecialAgent.removeAbility();
            this.currentSpecialAgent = null;
        }

        for (let agent of this.agents) {
            if (agent.isPlayerControlled) {
                continue;
            }

            if (agent.isCommuter) {
                this.ensureCommuterPath(agent);
                continue;
            }

            if (agent.plannedPath.length === 0) {
                agent.calculatePath(this.board);
            }
        }

        this.emit('gameStarted', { turn: this.currentTurn });
    }

    /**
     * Execute one turn
     */
    executeTurn() {
        if (!this.gameRunning || this.gameFinished) {
            return;
        }

        this.playerBlockUsed = false;
        this.updatePlayerBlocks();
        this.updateEventCooldowns();
        this.maybeCreateAccident();
        this.triggerRandomEvents();

        for (let agent of this.agents) {
            if (agent.status !== Agent.STATUS.ACTIVE) {
                continue;
            }

            if (agent.isPlayerControlled) {
                continue;
            }

            if (agent.isCommuter) {
                this.executeCommuterTurn(agent);
                continue;
            }

            // Handle photo delay
            if (agent.takingPhoto) {
                agent.updatePhotoDelay();
                agent.decrementTurns();
                continue;
            }

            if (agent.mustVisitJail && agent.jailTaskLocation &&
                agent.currentLocation.x === agent.jailTaskLocation.x &&
                agent.currentLocation.y === agent.jailTaskLocation.y) {
                agent.isInJail = true;
            }

            if (agent.isInJail && agent.jailSentence > 0) {
                agent.serveJailTime();
                agent.decrementTurns();

                if (agent.jailSentence === 0) {
                    agent.recalculatePath(this.board);
                }
                continue;
            }

            if (agent.healingTurnsRemaining && agent.healingTurnsRemaining > 0) {
                agent.healingTurnsRemaining--;
                agent.decrementTurns();

                if (agent.healingTurnsRemaining === 0) {
                    agent.recalculatePath(this.board);
                }
                continue;
            }

            if (agent.turnsRemaining <= 0) {
                agent.status = Agent.STATUS.FAILED;
                continue;
            }

            if (agent.needsRepath(this.board)) {
                agent.recalculatePath(this.board);
            }

            if (agent.plannedPath.length > 0 && agent.pathIndex < agent.plannedPath.length) {
                // Check for adjacent landmarks before moving
                const adjacentLandmark = this.getAdjacentLandmark(agent);
                if (adjacentLandmark) {
                    const photoStarted = agent.startPhotoDelay(adjacentLandmark);
                    if (photoStarted) {
                        agent.decrementTurns();
                        continue;
                    }
                }

                const nextPosition = agent.plannedPath[agent.pathIndex];
                const nextTile = this.board.getTile(nextPosition.x, nextPosition.y);

                // Bump check: another agent already standing on the tile we want to step into
                const blocker = this.agents.find(other =>
                    other !== agent &&
                    other.status !== Agent.STATUS.FAILED &&
                    other.currentLocation.x === nextPosition.x &&
                    other.currentLocation.y === nextPosition.y
                );
                if (blocker) {
                    this.emit('agentBumped', {
                        agent,
                        blocker,
                        x: nextPosition.x,
                        y: nextPosition.y,
                    });
                    agent.decrementTurns();
                    continue;
                }

                // Congestion-scaled slowdown: chance grows with congestion level (no hard threshold)
                if (nextTile && nextTile.congestion > 0 && this.config.congestionThreshold > 0) {
                    const ratio = nextTile.congestion / this.config.congestionThreshold;
                    const slowChance = Math.min(0.95, ratio * this.config.congestionSlowChance);
                    if (Math.random() < slowChance) {
                        // Check if agent can skip traffic jam (from MUSEUM bonus)
                        if (agent.skipNextTrafficJam) {
                            agent.skipNextTrafficJam = false;
                            console.log(`Agent ${agent.id} skipped a traffic jam using museum bonus!`);
                        } else {
                            nextTile.increaseCongestion();
                            this.emit('agentSlowed', {
                                agent,
                                x: nextPosition.x,
                                y: nextPosition.y,
                                congestion: nextTile.congestion,
                            });
                            agent.decrementTurns();
                            continue;
                        }
                    }
                }

                agent.moveOneStep();

                const currentTile = this.board.getTile(agent.currentLocation.x, agent.currentLocation.y);
                if (currentTile && currentTile.increaseCongestion) {
                    currentTile.increaseCongestion();
                }

                agent.checkArrival(this.board);

                if (!agent.arrivedAtJob &&
                    agent.currentLocation.x === agent.jobLocation.x &&
                    agent.currentLocation.y === agent.jobLocation.y &&
                    !agent.hasActiveTasks() &&
                    !agent.mustVisitJail &&
                    agent.jailSentence <= 0) {
                    agent.arrivedAtJob = true;
                    agent.status = Agent.STATUS.ARRIVED;
                }
            }

            // Update ability durations
            for (let agent of this.agents) {
                if (agent.updateAbilityDuration) {
                    agent.updateAbilityDuration();
                }
            }

            agent.decrementTurns();
        }

        for (let agent of this.agents) {
            if (!agent.isPlayerControlled && !agent.isCommuter && agent.status === Agent.STATUS.ACTIVE && agent.plannedPath.length === 0) {
                const recalculated = agent.calculatePath(this.board);
                if (!recalculated) {
                    agent.status = Agent.STATUS.FAILED;
                }
            }
        }

        this.board.update(1.0);
        this.currentTurn++;

        // Rotate special agent every 2 turns
        this.updateSpecialAgentRotation();

        this.emit('turnExecuted', {
            turn: this.currentTurn,
            agents: this.agents,
        });

        this.checkGameEnd();
    }

    /**
     * Check if game has ended
     */
    checkGameEnd() {
        if (this.currentTurn >= this.config.maxTurns) {
            this.endGame();
            return;
        }

        const relevantAgents = this.agents.filter(agent => !agent.isCommuter);
        const allArrived = relevantAgents.length > 0 && relevantAgents.every(agent =>
            agent.status === Agent.STATUS.ARRIVED || agent.arrivedAtJob === true
        );

        if (allArrived) {
            this.endGame();
        }
    }

    /**
     * End the game
     */
    endGame() {
        this.gameRunning = false;
        this.gameFinished = true;

        const stats = this.getGameStats();
        this.emit('gameEnded', stats);
    }

    /**
     * Reset game state
     */
    reset() {
        this.currentTurn = 0;
        this.gameRunning = false;
        this.gameFinished = false;
        this.turnsUntilNextRotation = 2;
        if (this.currentSpecialAgent) {
            this.currentSpecialAgent.removeAbility();
            this.currentSpecialAgent = null;
        }

        for (let agent of this.agents) {
            agent.reset();
        }

        this.emit('gameReset', {});
    }

    /**
     * Get game statistics
     * @returns {Object} Stats summary
     */
    getGameStats() {
        const relevantAgents = this.agents.filter(agent => !agent.isCommuter);
        const completed = relevantAgents.filter(agent =>
            agent.status === Agent.STATUS.ARRIVED || agent.arrivedAtJob === true
        ).length;
        const avgTurns = relevantAgents.length > 0
            ? relevantAgents.reduce((sum, a) => sum + a.turnsRemaining, 0) / relevantAgents.length
            : 0;

        return {
            turn: this.currentTurn,
            maxTurns: this.config.maxTurns,
            agentsCompleted: completed,
            totalAgents: relevantAgents.length,
            avgTurnsRemaining: avgTurns,
        };
    }

    /**
     * Ensure commuter has an active path to current commute stop
     * @param {Agent} agent
     */
    ensureCommuterPath(agent) {
        if (!agent || !agent.commuterStops || agent.commuterStops.length < 2) {
            return;
        }

        if (typeof agent.commuterTargetIndex !== 'number') {
            agent.commuterTargetIndex = 1;
        }

        const target = agent.commuterStops[agent.commuterTargetIndex];
        if (!target) {
            return;
        }

        if (agent.currentLocation.x === target.x && agent.currentLocation.y === target.y) {
            agent.commuterTargetIndex = (agent.commuterTargetIndex + 1) % agent.commuterStops.length;
        }

        if (agent.plannedPath.length > 0 && agent.pathIndex < agent.plannedPath.length) {
            return;
        }

        const nextTarget = agent.commuterStops[agent.commuterTargetIndex];
        const path = Utils.findPath(this.board, agent.currentLocation, nextTarget);

        if (Array.isArray(path) && path.length > 1) {
            agent.setPath(path.slice(1));
        } else {
            agent.plannedPath = [];
            agent.pathIndex = 0;
        }
    }

    /**
     * Execute one step of commuter movement on repeatable route
     * @param {Agent} agent
     */
    executeCommuterTurn(agent) {
        this.ensureCommuterPath(agent);

        if (agent.plannedPath.length > 0 && agent.pathIndex < agent.plannedPath.length) {
            agent.moveOneStep();
        }

        const currentTile = this.board.getTile(agent.currentLocation.x, agent.currentLocation.y);
        if (currentTile && currentTile.increaseCongestion) {
            currentTile.increaseCongestion();
        }

        const target = agent.commuterStops[agent.commuterTargetIndex];
        if (target && agent.currentLocation.x === target.x && agent.currentLocation.y === target.y) {
            agent.commuterTargetIndex = (agent.commuterTargetIndex + 1) % agent.commuterStops.length;
            agent.plannedPath = [];
            agent.pathIndex = 0;
        }

        agent.status = Agent.STATUS.ACTIVE;
        agent.arrivedAtJob = false;
    }

    /**
     * Get current turn
     * @returns {number} Turn index
     */
    getTurn() {
        return this.currentTurn;
    }

    /**
     * Get max turns
     * @returns {number} Max turns
     */
    getMaxTurns() {
        return this.config.maxTurns;
    }

    /**
     * Check if game is running
     * @returns {boolean} True if running
     */
    isRunning() {
        return this.gameRunning;
    }

    /**
     * Serialize state
     * @returns {Object} Serialized state
     */
    serialize() {
        return {
            turn: this.currentTurn,
            maxTurns: this.config.maxTurns,
            running: this.gameRunning,
            finished: this.gameFinished,
            agentStates: this.agents.map(a => a.serialize()),
        };
    }
}

if (typeof window !== 'undefined') {
    window.TurnManager = TurnManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TurnManager;
}
