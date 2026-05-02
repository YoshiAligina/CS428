/**
 * Agent.js - Agent class representing a person navigating the city
 * 
 * An Agent moves through the grid trying to complete tasks within a time limit.
 * Agents start at HOME, can visit intermediate locations (CAFE, LANDMARK, HOSPITAL),
 * and must reach their JOB location before time runs out.
 * 
 * States:
 * - ACTIVE: Agent is moving and still has turns remaining
 * - ARRIVED: Agent successfully reached job location
 * - FAILED: Agent ran out of turns before arriving
 */

class Agent {
    /**
     * Agent status enumeration
     */
    static STATUS = {
        ACTIVE: 'ACTIVE',
        ARRIVED: 'ARRIVED',
        FAILED: 'FAILED',
    };

    /**
     * Task type enumeration
     */
    static TASK_TYPE = {
        CAFE: 'CAFE',
        HOSPITAL: 'HOSPITAL',
        JAIL: 'JAIL',
        LANDMARK: 'LANDMARK',
        JOB: 'JOB',
    };

    /**
     * Get agent constants with fallback values
     * @returns {Object} Agent constants
     */
    static getConstants() {
        return (typeof window !== 'undefined' && window.GAME_CONSTANTS)
            ? window.GAME_CONSTANTS
            : { TURN_LIMIT: 18 };
    }

    /**
     * Constructor
     * @param {string} id - Unique agent identifier
     * @param {Object} homeLocation - Home position {x, y}
     * @param {Object} jobLocation - Job destination {x, y}
     * @param {string} color - Hex color for rendering (e.g., '#4da6ff')
     * @param {Board} board - Board instance for initial pathfinding
     */
    constructor(id, homeLocation, jobLocation, color = '#4da6ff', board = null) {
        // Identity
        this.id = id;
        this.name = `Agent ${id}`;

        // Locations
        this.homeLocation = { ...homeLocation };
        this.jobLocation = { ...jobLocation };
        this.currentLocation = { ...homeLocation };

        // Navigation
        this.plannedPath = [];  // Array of {x, y} coordinates
        this.pathIndex = 0;     // Current position in path

        // Tasks
        this.tasksQueue = [];   // Array of {type, location, completed}
        this.completedTasks = [];

        // Time budget
        const constants = Agent.getConstants();
        this.turnsRemaining = constants.TURN_LIMIT;
        this.turnsElapsed = 0;
        this.maxTurns = constants.TURN_LIMIT;

        // Status
        this.status = Agent.STATUS.ACTIVE;
        this.arrivedAtJob = false;

        // Ability system
        this.hasAbility = false;
        this.abilityType = 'NONE';
        this.abilityCharges = 0;
        this.turnsUntilAbilityLost = 0;

        // Injury system
        this.isInjured = false;
        this.mustVisitHospital = false;
        this.hospitalTaskLocation = null;
        this.healingTurnsRemaining = 0;
        this.injuryCooldown = 0;  // turns of immunity to injury after recovery

        // Crime system
        this.isCriminal = false;
        this.mustVisitJail = false;
        this.jailSentence = 0;
        this.jailTaskLocation = null;
        this.isInJail = false;
        this.crimeCooldown = 0;  // turns of immunity to crime after release

        // Photo delay system
        this.visitedLandmarks = new Set();  // Set of landmark coordinates as strings: "x,y"
        this.takingPhoto = false;           // Currently taking a photo
        this.photoTurnsRemaining = 0;       // Turns left for photo delay

        // Landmark bonuses
        this.skipNextTrafficJam = false;    // Skip next traffic jam (from MUSEUM)
        this.stressReliefUsed = false;      // Track if stress relief bonus was used this turn

        // Rendering
        this.color = color;

        // Debug info
        this.movementHistory = [];  // Track all moves for debugging

        // Calculate initial path if board provided
        if (board) {
            this.calculatePath(board);
        }
    }

    /**
     * Calculate path from current location to next destination
     * Uses A* pathfinding algorithm from Utils
     * Sets plannedPath and updates status if no path found
     * @param {Board} board - Board instance for pathfinding
     * @returns {boolean} True if path found, false if no path exists
     */
    calculatePath(board) {
        try {
            if (!board) {
                console.error(`Agent ${this.id}: No board provided for pathfinding`);
                return false;
            }

            // Get next destination
            const destination = this.getNextDestination();
            if (!destination) {
                console.error(`Agent ${this.id}: No destination available`);
                return false;
            }

            // Validate start and destination tiles
            const startTile = board.getTile(this.currentLocation.x, this.currentLocation.y);
            const goalTile = board.getTile(destination.x, destination.y);

            if (!startTile || !startTile.isWalkable) {
                console.error(`Agent ${this.id}: Start position (${this.currentLocation.x},${this.currentLocation.y}) is not walkable. Tile: ${startTile ? startTile.type : 'null'}`);
                this.status = Agent.STATUS.FAILED;
                return false;
            }

            if (!goalTile || !goalTile.isWalkable) {
                console.error(`Agent ${this.id}: Goal position (${destination.x},${destination.y}) is not walkable. Tile: ${goalTile ? goalTile.type : 'null'}`);
                this.status = Agent.STATUS.FAILED;
                return false;
            }

            // Use A* pathfinding to find path
            const path = Utils.findPath(board, this.currentLocation, destination);

            // Check if path was found
            if (!path || path.length === 0) {
                console.error(`Agent ${this.id}: No path found from (${this.currentLocation.x},${this.currentLocation.y}) to (${destination.x},${destination.y})`);
                this.plannedPath = [];
                this.pathIndex = 0;
                this.status = Agent.STATUS.FAILED;
                return false;
            }

            // Remove first element (current location) from path since agent is already there
            const cleanPath = path.length > 1 ? path.slice(1) : [];
            this.setPath(cleanPath);
            return true;

        } catch (error) {
            console.error(`Agent ${this.id}: Error during pathfinding: ${error.message}`);
            this.status = Agent.STATUS.FAILED;
            return false;
        }
    }

    /**
     * Recalculate path when current path is blocked or invalidated
     * Clears current path and computes new one
     * @param {Board} board - Board instance for pathfinding
     * @returns {boolean} True if new path found
     */
    recalculatePath(board) {
        if (!board) {
            return false;
        }

        // Clear current path
        this.plannedPath = [];
        this.pathIndex = 0;

        // Calculate new path
        return this.calculatePath(board);
    }

    /**
     * Add a task to the tasks queue
     * @param {string} taskType - Task type (CAFE, HOSPITAL, LANDMARK)
     * @param {Object} taskLocation - Task location {x, y}
     * @returns {boolean} True if task was added successfully
     */
    addTask(taskType, taskLocation, extras = {}) {
        // Validate task type
        if (!Object.values(Agent.TASK_TYPE).includes(taskType)) {
            console.warn(`Invalid task type: ${taskType}`);
            return false;
        }

        // Validate location
        if (!taskLocation || typeof taskLocation.x !== 'number' || typeof taskLocation.y !== 'number') {
            console.warn('Invalid task location');
            return false;
        }

        const task = {
            type: taskType,
            location: { ...taskLocation },
            completed: false,
            addedAtTurn: this.turnsElapsed,
            ...extras,
        };

        this.tasksQueue.push(task);
        return true;
    }

    /**
     * Check if agent has uncompleted tasks
     * @returns {boolean} True if there are active tasks in queue
     */
    hasActiveTasks() {
        return this.tasksQueue.some(task => !task.completed);
    }

    /**
     * Get the next destination for the agent
     * Priority order:
     * 1. Criminal: must visit jail first
     * 2. Injured: must visit hospital first
     * 3. Tasks: visit each task in order (in queue)
     * 4. Job: only when all tasks complete and no jail/hospital obligations
     * @returns {Object} Next destination {x, y} or null if no destination
     */
    getNextDestination() {
        // Criminal agents must visit jail first
        if (this.mustVisitJail && this.jailTaskLocation) {
            return { ...this.jailTaskLocation };
        }

        // Injured agents must visit hospital first
        if (this.mustVisitHospital && this.hospitalTaskLocation) {
            return { ...this.hospitalTaskLocation };
        }

        // Check for uncompleted tasks - MUST complete ALL tasks before job
        for (const task of this.tasksQueue) {
            if (!task.completed) {
                return { ...task.location };
            }
        }

        // Only go to job when all tasks are complete
        return { ...this.jobLocation };
    }

    /**
     * Move agent one step along planned path
     * Updates currentLocation to next position in path
     * @returns {boolean} True if movement was successful, false if no path or at end
     */
    moveOneStep() {
        // Check if path exists and is valid
        if (!this.plannedPath || this.plannedPath.length === 0) {
            console.warn(`Agent ${this.id}: No path planned`);
            return false;
        }

        // Check if already at end of path
        if (this.pathIndex >= this.plannedPath.length) {
            console.warn(`Agent ${this.id}: Already at end of path`);
            return false;
        }

        // Move to next position
        const nextPosition = this.plannedPath[this.pathIndex];
        this.currentLocation = { ...nextPosition };
        this.pathIndex++;

        // Record movement history
        this.movementHistory.push({
            turn: this.turnsElapsed,
            position: { ...this.currentLocation },
        });

        return true;
    }

    /**
     * Set the planned path for agent
     * @param {Array} path - Array of {x, y} coordinates
     */
    setPath(path) {
        if (!Array.isArray(path) || path.length === 0) {
            console.warn(`Agent ${this.id}: Invalid path provided`);
            this.plannedPath = [];
            this.pathIndex = 0;
            return false;
        }

        this.plannedPath = path.map(pos => ({ ...pos }));
        this.pathIndex = 0;
        return true;
    }

    /**
     * Get the planned path
     * @returns {Array} Copy of planned path
     */
    getPath() {
        return this.plannedPath.map(pos => ({ ...pos }));
    }

    /**
     * Get current position in path (for debugging)
     * @returns {number} Current path index
     */
    getPathProgress() {
        return {
            current: this.pathIndex,
            total: this.plannedPath.length,
            percentage: this.plannedPath.length > 0 
                ? (this.pathIndex / this.plannedPath.length * 100).toFixed(1) 
                : 0,
        };
    }

    /**
     * Decrement turns remaining
     * Checks if agent has failed (time ran out)
     * @returns {boolean} True if agent is still active, false if failed
     */
    decrementTurns() {
        this.turnsRemaining--;
        this.turnsElapsed++;

        // Check for failure condition
        if (this.turnsRemaining <= 0 && !this.arrivedAtJob) {
            this.status = Agent.STATUS.FAILED;
            console.warn(`Agent ${this.id} failed: Time limit exceeded`);
            return false;
        }

        return true;
    }

    /**
     * Get remaining turns
     * @returns {number} Turns remaining
     */
    getTurnsRemaining() {
        return this.turnsRemaining;
    }

    /**
     * Get time budget percentage used
     * @returns {number} Percentage (0-100)
     */
    getTimeUsagePercentage() {
        return Math.round((this.turnsElapsed / this.maxTurns) * 100);
    }

    /**
     * Check if agent has arrived at current destination
     * Updates task completion or job arrival status
     * Sets status='ARRIVED' only when at jobLocation with no pending tasks
     * @param {Board} board - Board instance for validation
     * @returns {boolean} True if arrived at a destination
     */
    checkArrival(board) {
        if (!board) {
            console.warn('Board not provided to checkArrival');
            return false;
        }

        const currentTile = board.getTile(this.currentLocation.x, this.currentLocation.y);

        let arrived = false;
        let taskCompleted = false;

        // Check for task completion
        for (const task of this.tasksQueue) {
            if (!task.completed &&
                this.currentLocation.x === task.location.x &&
                this.currentLocation.y === task.location.y) {

                task.completed = true;
                this.completedTasks.push(task);
                console.log(`Agent ${this.id} completed task: ${task.type} at (${task.location.x}, ${task.location.y})`);
                taskCompleted = true;
                arrived = true;
                break;  // Complete one task at a time
            }
        }

        // If task was completed, recalculate path to next destination
        if (taskCompleted) {
            this.recalculatePath(board);
        }

        // Check for hospital visit when injured (any hospital tile is valid)
        if (this.mustVisitHospital && currentTile && currentTile.type === Tile.TYPES.HOSPITAL) {
            this.visitHospital();
            this.healingTurnsRemaining = 1;
            arrived = true;
        }

        // Check for jail arrival when criminal (any jail tile is valid)
        if (this.mustVisitJail && currentTile && currentTile.type === Tile.TYPES.JAIL) {
            this.isInJail = true;
            arrived = true;
        }

        // Check for job arrival
        // ONLY succeed if: at job location AND all required conditions met
        if (this.currentLocation.x === this.jobLocation.x &&
            this.currentLocation.y === this.jobLocation.y) {
            
            // Check if can arrive at job
            const canReachJob = !this.hasActiveTasks() &&  // All tasks must be complete
                                !this.mustVisitJail &&      // No jail obligation
                                this.jailSentence <= 0;      // Jail sentence must be served

            if (canReachJob) {
                this.arrivedAtJob = true;
                this.status = Agent.STATUS.ARRIVED;
                console.log(`Agent ${this.id} successfully reached job after completing all tasks!`);
                
                // Add job completion as a task
                const jobTask = {
                    type: Agent.TASK_TYPE.JOB,
                    location: { ...this.jobLocation },
                    completed: true,
                    addedAtTurn: this.turnsElapsed,
                };
                this.completedTasks.push(jobTask);
                
                arrived = true;
            } else {
                // Agent reached job but can't succeed - log why
                if (this.hasActiveTasks()) {
                    console.warn(`Agent ${this.id} reached job but has uncompleted tasks!`);
                }
                if (this.mustVisitJail) {
                    console.warn(`Agent ${this.id} reached job but must visit jail!`);
                }
                if (this.jailSentence > 0) {
                    console.warn(`Agent ${this.id} reached job but has pending jail sentence!`);
                }
            }
        }

        return arrived;
    }

    /**
     * Injure the agent and force hospital visit
     * @param {Object} hospitalLocation - Hospital location {x, y}
     */
    injure(hospitalLocation) {
        if (this.isInjured || !hospitalLocation) {
            return false;
        }

        this.isInjured = true;
        this.mustVisitHospital = true;
        this.hospitalTaskLocation = { ...hospitalLocation };

        const hospitalTask = {
            type: Agent.TASK_TYPE.HOSPITAL,
            location: { ...hospitalLocation },
            completed: false,
            addedAtTurn: this.turnsElapsed,
            isHospitalTask: true,
        };

        this.tasksQueue.unshift(hospitalTask);
        return true;
    }

    /**
     * Commit a crime and force jail visit
     * @param {Object} jailLocation - Jail location {x, y}
     */
    commitCrime(jailLocation) {
        if (this.isCriminal || !jailLocation) {
            return false;
        }

        const sentence = (typeof Utils !== 'undefined' && Utils.randomInt)
            ? Utils.randomInt(2, 4)
            : (Math.random() < 0.5 ? 2 : (Math.random() < 0.5 ? 3 : 4));

        this.isCriminal = true;
        this.mustVisitJail = true;
        this.jailSentence = sentence;
        this.jailTaskLocation = { ...jailLocation };
        this.isInJail = false;

        const jailTask = {
            type: Agent.TASK_TYPE.JAIL,
            location: { ...jailLocation },
            completed: false,
            addedAtTurn: this.turnsElapsed,
            isJailTask: true,
        };

        this.tasksQueue.unshift(jailTask);
        return true;
    }

    /**
     * Serve jail time
     */
    serveJailTime() {
        if (!this.isCriminal || this.jailSentence <= 0) {
            return false;
        }

        this.jailSentence = Math.max(0, this.jailSentence - 1);

        if (this.jailSentence === 0) {
            this.isCriminal = false;
            this.mustVisitJail = false;
            this.isInJail = false;
            this.jailTaskLocation = null;
            this.crimeCooldown = 6;  // grace period before another crime can hit
            this.tasksQueue = this.tasksQueue.filter(task => task.type !== Agent.TASK_TYPE.JAIL);
        }

        return true;
    }

    /**
     * Complete hospital visit and clear injury state
     */
    visitHospital() {
        this.isInjured = false;
        this.mustVisitHospital = false;
        this.hospitalTaskLocation = null;
        this.injuryCooldown = 6;  // grace period before another injury can hit

        // Only clear injury-driven hospital tasks; preserve voluntary ones (e.g. MEDICINE)
        this.tasksQueue = this.tasksQueue.filter(task =>
            !(task.type === Agent.TASK_TYPE.HOSPITAL && task.isHospitalTask === true)
        );
    }

    /**
     * Grant a special ability to the agent
     * @param {string} type - Ability type (e.g., 'ROADBLOCK')
     * @param {number} charges - Number of uses available
     * @param {number} duration - Turns until ability is removed
     */
    grantAbility(type, charges, duration) {
        this.hasAbility = true;
        this.abilityType = type || 'NONE';
        this.abilityCharges = Math.max(0, charges || 0);
        this.turnsUntilAbilityLost = Math.max(0, duration || 0);
    }

    /**
     * Remove any special ability from the agent
     */
    removeAbility() {
        this.hasAbility = false;
        this.abilityType = 'NONE';
        this.abilityCharges = 0;
        this.turnsUntilAbilityLost = 0;
    }

    /**
     * Check if agent can use its ability
     * @returns {boolean} True if ability is usable
     */
    canUseAbility() {
        return this.hasAbility && this.abilityCharges > 0;
    }

    /**
     * Use the agent's ability
     * @param {Board} board - Board instance
     * @param {number} targetX - Target x coordinate
     * @param {number} targetY - Target y coordinate
     * @returns {boolean} True if ability was used
     */
    useAbility(board, targetX, targetY) {
        if (!this.canUseAbility() || !board) {
            return false;
        }

        if (this.abilityType === 'ROADBLOCK') {
            const tile = board.getTile(targetX, targetY);
            if (!tile || !tile.isWalkable || tile.isBlocked) {
                return false;
            }

            const duration = (typeof Utils !== 'undefined' && Utils.randomInt)
                ? Utils.randomInt(2, 3)
                : (Math.random() < 0.5 ? 2 : 3);

            tile.blockTile(duration, 'ability-roadblock');
            this.abilityCharges = Math.max(0, this.abilityCharges - 1);
            return true;
        }

        return false;
    }

    /**
     * Update ability duration each turn
     */
    updateAbilityDuration() {
        if (!this.hasAbility) return;

        this.turnsUntilAbilityLost--;
        if (this.turnsUntilAbilityLost <= 0) {
            this.removeAbility();
        }
    }

    /**
     * Check if planned path is still valid
     * Path becomes invalid if it contains blocked tiles
     * @param {Board} board - Board to check against
     * @returns {boolean} True if path needs recalculation
     */
    needsRepath(board) {
        if (!board || !this.plannedPath || this.plannedPath.length === 0) {
            return true;
        }

        // Check each tile in path for blockage
        for (const position of this.plannedPath) {
            const tile = board.getTile(position.x, position.y);

            // Tile doesn't exist or is blocked
            if (!tile || tile.isBlocked) {
                return true;
            }
        }

        return false;
    }

    /**
     * Execute one turn of agent activity
     * Called by TurnManager each turn
     * @param {Board} board - Board for validation
     * @returns {Object} Turn result {moved, arrived, status}
     */
    executeTurn(board) {
        const result = {
            moved: false,
            arrived: false,
            status: this.status,
        };

        if (this.status !== Agent.STATUS.ACTIVE) {
            return result;
        }

        // Check if path needs recalculation
        if (this.needsRepath(board)) {
            return result;
        }

        // Attempt to move
        if (this.moveOneStep()) {
            result.moved = true;

            // Check for arrival at destination
            if (this.checkArrival(board)) {
                result.arrived = true;
            }
        }

        // Decrement turn counter
        this.decrementTurns();
        result.status = this.status;

        return result;
    }

    /**
     * Get agent statistics
     * @returns {Object} Agent stats
     */
    getStats() {
        return {
            id: this.id,
            name: this.name,
            currentLocation: { ...this.currentLocation },
            homeLocation: { ...this.homeLocation },
            jobLocation: { ...this.jobLocation },
            arrivedAtJob: this.arrivedAtJob,
            status: this.status,
            turnsElapsed: this.turnsElapsed,
            turnsRemaining: this.turnsRemaining,
            timeUsage: this.getTimeUsagePercentage(),
            tasksCompleted: this.completedTasks.length,
            tasksRemaining: this.tasksQueue.filter(t => !t.completed).length,
            pathProgress: this.getPathProgress(),
            movementHistory: this.movementHistory.length,
        };
    }

    /**
     * Get agent status string for debugging
     * @returns {string} Status description
     */
    getStatusString() {
        let status = `${this.name} [${this.status}]`;
        status += ` @ (${this.currentLocation.x},${this.currentLocation.y})`;
        status += ` | Time: ${this.turnsElapsed}/${this.maxTurns}`;
        status += ` | Tasks: ${this.completedTasks.length}/${this.tasksQueue.length}`;

        if (this.arrivedAtJob) {
            status += ' | ✓ ARRIVED';
        }

        return status;
    }

    /**
     * Serialize agent state for network transmission or logging
     * @returns {Object} Serialized data
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            currentLocation: { ...this.currentLocation },
            homeLocation: { ...this.homeLocation },
            jobLocation: { ...this.jobLocation },
            arrivedAtJob: this.arrivedAtJob,
            status: this.status,
            turnsElapsed: this.turnsElapsed,
            turnsRemaining: this.turnsRemaining,
            tasksCompleted: this.completedTasks.map(t => ({
                type: t.type,
                location: t.location,
            })),
            color: this.color,
        };
    }

    /**
     * Reset agent to initial state
     */
    reset() {
        this.currentLocation = { ...this.homeLocation };
        this.plannedPath = [];
        this.pathIndex = 0;
        this.tasksQueue = [];
        this.completedTasks = [];
        this.turnsRemaining = this.maxTurns;
        this.turnsElapsed = 0;
        this.status = Agent.STATUS.ACTIVE;
        this.arrivedAtJob = false;
        this.movementHistory = [];
        this.removeAbility();
        this.isInjured = false;
        this.mustVisitHospital = false;
        this.hospitalTaskLocation = null;
        this.healingTurnsRemaining = 0;
        this.injuryCooldown = 0;
        this.isCriminal = false;
        this.mustVisitJail = false;
        this.jailSentence = 0;
        this.jailTaskLocation = null;
        this.isInJail = false;
        this.crimeCooldown = 0;
        this.visitedLandmarks = new Set();
        this.takingPhoto = false;
        this.photoTurnsRemaining = 0;
        this.skipNextTrafficJam = false;
        this.stressReliefUsed = false;
    }

    /**
     * Start photo delay at a landmark
     * @param {Tile} landmark - Landmark tile with photo delay
     */
    startPhotoDelay(landmark) {
        if (!landmark || !landmark.photoDelay) {
            return false;
        }

        const coordKey = `${landmark.x},${landmark.y}`;
        if (this.visitedLandmarks.has(coordKey)) {
            return false;  // Already visited this landmark
        }

        this.takingPhoto = true;
        this.photoTurnsRemaining = landmark.photoDelay;
        this.visitedLandmarks.add(coordKey);

        // Apply landmark bonuses
        if (landmark.landmarkBonus) {
            if (landmark.landmarkBonus === 'STRESS_RELIEF') {
                // PARK: Add 1 turn to limit
                this.turnsRemaining++;
                this.maxTurns++;
                console.log(`Agent ${this.id} visited ${landmark.landmarkType}! Stress relief: +1 turn added!`);
            } else if (landmark.landmarkBonus === 'SKIP_TRAFFIC') {
                // MUSEUM: Skip next traffic jam
                this.skipNextTrafficJam = true;
                console.log(`Agent ${this.id} visited ${landmark.landmarkType}! Can skip next traffic jam!`);
            } else if (landmark.landmarkBonus === 'QUICK_PHOTO') {
                // PLAZA: Already has reduced photo delay (1 turn)
                console.log(`Agent ${this.id} visited ${landmark.landmarkType}! Quick photo taken!`);
            }
        }

        console.log(`Agent ${this.id} is taking a photo at ${landmark.landmarkType}! Photo delay: ${this.photoTurnsRemaining} turns`);
        return true;
    }

    /**
     * Update photo delay countdown
     */
    updatePhotoDelay() {
        if (!this.takingPhoto) {
            return;
        }

        this.photoTurnsRemaining--;
        if (this.photoTurnsRemaining <= 0) {
            this.takingPhoto = false;
            console.log(`Agent ${this.id} finished taking photo.`);
        }
    }
}

// Expose to browser global scope when available
if (typeof window !== 'undefined') {
    window.Agent = Agent;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Agent;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Agent;
}
