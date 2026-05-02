/**
 * UIController.js - Bridges game state and HTML UI
 * Updates UI elements based on game state changes
 */

class UIController {
    constructor(turnManager, board, agents) {
        this.turnManager = turnManager;
        this.board = board;
        this.agents = agents;
        this.uiElements = {};
        this.roadblockMode = false;
        
        // Autoplay state
        this.isAutoplayActive = false;
        this.autoplaySpeed = 5; // 1-10 scale (multiplier for turn speed)
        this.autoplayCounter = 0;
        this.autoplayInterval = null;

        // Input mode
        this.keyboardOnlyMode = true;
    }

    /**
     * Initialize UI controller - get element references and add listeners
     */
    init() {
        // Top bar elements
        this.uiElements.turnNumber = document.getElementById('turnNumber');
        this.uiElements.maxTurns = document.getElementById('maxTurns');
        this.uiElements.gameStatus = document.getElementById('gameStatus');
        this.uiElements.statusText = document.getElementById('statusText');
        this.uiElements.currentTime = document.getElementById('currentTime');
        this.uiElements.specialAgentPanel = document.getElementById('specialAgentPanel');
        this.uiElements.specialAgentName = document.getElementById('specialAgentName');
        this.uiElements.specialAgentCountdown = document.getElementById('specialAgentCountdownValue');

        // Side panel
        this.uiElements.agentList = document.getElementById('agentList');

        // Action panel
        this.uiElements.endTurnBtn = document.getElementById('endTurnBtn');
        this.uiElements.placeRoadblockBtn = document.getElementById('placeRoadblockBtn');
        this.uiElements.blockCounter = null; // Will create dynamically
        
        // New UI panels
        this.uiElements.taskChecklist = document.getElementById('taskChecklist');
        this.uiElements.statisticsPanel = document.getElementById('statisticsPanel');
        this.uiElements.turnTimeline = document.getElementById('turnTimeline');
        this.uiElements.moveUpBtn = document.getElementById('moveUpBtn');
        this.uiElements.moveDownBtn = document.getElementById('moveDownBtn');
        this.uiElements.moveLeftBtn = document.getElementById('moveLeftBtn');
        this.uiElements.moveRightBtn = document.getElementById('moveRightBtn');
        this.uiElements.mapLegend = document.getElementById('mapLegend');
        this.uiElements.timelineProgress = document.getElementById('timelineProgress');
        this.uiElements.timelineElapsed = document.getElementById('timelineElapsed');
        this.uiElements.timelineTotal = document.getElementById('timelineTotal');

        // Tile inspector
        this.uiElements.tileInspector = document.getElementById('tileInspector');
        this.uiElements.closeTileInspector = document.getElementById('closeTileInspector');
        this.uiElements.tilePosition = document.getElementById('tilePosition');
        this.uiElements.tileType = document.getElementById('tileType');
        this.uiElements.tileCongestion = document.getElementById('tileCongestion');
        this.uiElements.tileBlocked = document.getElementById('tileBlocked');
        this.uiElements.tileAgents = document.getElementById('tileAgents');

        // Game over overlay
        this.uiElements.gameOverOverlay = document.getElementById('gameOverOverlay');
        this.uiElements.gameOverTitle = document.getElementById('gameOverTitle');
        this.uiElements.gameOverTurns = document.getElementById('gameOverTurns');
        this.uiElements.gameOverSuccess = document.getElementById('gameOverSuccess');
        this.uiElements.gameOverFail = document.getElementById('gameOverFail');
        this.uiElements.gameOverCongestion = document.getElementById('gameOverCongestion');
        this.uiElements.gameOverTasks = document.getElementById('gameOverTasks');
        this.uiElements.playAgainBtn = document.getElementById('playAgainBtn');

        // New autoplay and legend controls
        this.uiElements.autoplayBtn = document.getElementById('autoplayBtn');
        this.uiElements.speedSlider = document.getElementById('speedSlider');
        this.uiElements.speedDisplay = document.getElementById('speedDisplay');
        this.uiElements.zoomSlider = document.getElementById('zoomSlider');
        this.uiElements.zoomDisplay = document.getElementById('zoomDisplay');
        this.uiElements.legendMinimizeBtn = document.getElementById('legendMinimizeBtn');
        this.uiElements.legendContent = document.getElementById('legendContent');
        this.uiElements.turnBanner = document.getElementById('turnBanner');
        this.uiElements.turnBannerLabel = document.getElementById('turnBannerLabel');
        this.uiElements.toastContainer = document.getElementById('toastContainer');
        this.uiElements.resetViewBtn = document.getElementById('resetViewBtn');

        // Track time-warning thresholds we've already announced this game
        this._timeWarningsShown = new Set();

        // Add event listeners
        this.uiElements.endTurnBtn.addEventListener('click', () => this.onEndTurnClick());
        this.uiElements.placeRoadblockBtn.addEventListener('click', () => this.onRoadblockToggle());
        this.uiElements.closeTileInspector.addEventListener('click', () => this.hideTileInspector());
        if (this.uiElements.playAgainBtn) {
            this.uiElements.playAgainBtn.addEventListener('click', () => this.resetGame());
        }

        // Add autoplay listeners
        if (this.uiElements.autoplayBtn) {
            this.uiElements.autoplayBtn.addEventListener('click', () => this.toggleAutoplay());
        }
        if (this.uiElements.speedSlider) {
            this.uiElements.speedSlider.addEventListener('input', (e) => this.updateSpeed(parseInt(e.target.value)));
        }
        if (this.uiElements.zoomSlider) {
            this.uiElements.zoomSlider.addEventListener('input', (e) => this.updateZoom(parseInt(e.target.value, 10)));
        }
        if (this.uiElements.legendMinimizeBtn) {
            this.uiElements.legendMinimizeBtn.addEventListener('click', () => this.toggleLegendMinimize());
        }
        if (this.uiElements.resetViewBtn) {
            this.uiElements.resetViewBtn.addEventListener('click', () => {
                if (window.gameRenderer && typeof window.gameRenderer.resetCameraView === 'function') {
                    window.gameRenderer.resetCameraView();
                }
            });
        }

        if (this.uiElements.zoomSlider && window.gameRenderer && typeof window.gameRenderer.getZoomDistance === 'function') {
            const zoomDistance = Math.round(window.gameRenderer.getZoomDistance());
            const zoomLevel = 100 - zoomDistance;
            this.uiElements.zoomSlider.value = zoomLevel;
            if (this.uiElements.zoomDisplay) {
                this.uiElements.zoomDisplay.textContent = zoomLevel.toString();
            }
        }

        // Add block counter span to button
        const counterSpan = document.createElement('span');
        counterSpan.id = 'blockCounter';
        counterSpan.className = 'block-counter';
        counterSpan.textContent = '(1/1)';
        this.uiElements.placeRoadblockBtn.appendChild(counterSpan);
        this.uiElements.blockCounter = counterSpan;

        if (this.keyboardOnlyMode) {
            this.applyKeyboardOnlyMode();
        }

        // Set max turns display
        const defaultMaxTurns = (typeof window !== 'undefined' && window.GAME_CONSTANTS)
            ? window.GAME_CONSTANTS.TURN_LIMIT
            : 50;
        const configuredMaxTurns = (this.turnManager && this.turnManager.config && this.turnManager.config.maxTurns)
            ? this.turnManager.config.maxTurns
            : defaultMaxTurns;
        this.uiElements.maxTurns.textContent = configuredMaxTurns;

        // Initial UI update
        this.updateTurnDisplay();
        this.updateAgentList();
        this.updateTaskChecklist();
        this.updateStatistics();
        this.updateTurnTimeline();
        this.updateGameStatus('ready');

    }

    /**
     * Hide controls that are not used in keyboard-only mode
     */
    applyKeyboardOnlyMode() {
        if (this.uiElements.specialAgentPanel) {
            this.uiElements.specialAgentPanel.style.display = 'none';
        }

        if (this.uiElements.endTurnBtn) {
            this.uiElements.endTurnBtn.style.display = 'none';
            this.uiElements.endTurnBtn.disabled = true;
        }

        if (this.uiElements.autoplayBtn) {
            this.uiElements.autoplayBtn.style.display = 'none';
            this.uiElements.autoplayBtn.disabled = true;
        }

        if (this.uiElements.placeRoadblockBtn) {
            this.uiElements.placeRoadblockBtn.style.display = 'none';
            this.uiElements.placeRoadblockBtn.disabled = true;
        }

        if (this.uiElements.speedSlider) {
            this.uiElements.speedSlider.disabled = true;
        }

        const speedControl = document.querySelector('.speed-control');
        if (speedControl) {
            speedControl.style.display = 'none';
        }
    }

    /**
     * Handle movement button click
     * @param {number} dx
     * @param {number} dy
     */
    onMoveButton(dx, dy) {
        if (window.game && typeof window.game.movePlayer === 'function') {
            window.game.movePlayer(dx, dy);
        }
    }

    /**
     * Update turn counter display with flip animation
     */
    updateTurnDisplay() {
        const currentTurn = this.turnManager.currentTurn || 0;
        
        // Add flip animation
        this.uiElements.turnNumber.classList.add('flip');
        
        setTimeout(() => {
            this.uiElements.turnNumber.textContent = currentTurn;
        }, 300);
        
        setTimeout(() => {
            this.uiElements.turnNumber.classList.remove('flip');
        }, 600);

        const currentTimeText = this.getCurrentCommuteTimeText(currentTurn);
        if (this.uiElements.currentTime) {
            this.uiElements.currentTime.textContent = currentTimeText;
        }

        // Update commute lighting in renderer (7:00 AM → 9:00 AM)
        if (window.gameRenderer && window.gameRenderer.updateCommuteLighting) {
            window.gameRenderer.updateCommuteLighting(currentTurn);
        }
        
        // Update block counter
        this.updateBlockCounter();

        // Update special agent status
        this.updateSpecialAgentStatus();

        // Update whose-turn banner
        this.updateTurnBanner();

        // Low-time warning: flash counter + toast at 10/5/1 turns remaining
        this.applyLowTimeWarning();
    }

    /**
     * Update the floating "whose turn" banner above the canvas.
     */
    updateTurnBanner() {
        if (!this.uiElements.turnBanner || !this.uiElements.turnBannerLabel) return;

        if (this.turnManager && this.turnManager.gameFinished) {
            this.uiElements.turnBanner.classList.add('hidden');
            return;
        }

        const players = this.agents.filter(a => a.isPlayerControlled);
        if (players.length === 0) {
            this.uiElements.turnBanner.classList.add('hidden');
            return;
        }

        const activePlayer = (window.game && typeof window.game.getActivePlayer === 'function')
            ? window.game.getActivePlayer()
            : null;

        if (activePlayer && activePlayer.status === Agent.STATUS.ACTIVE) {
            const name = activePlayer.name || 'Player';
            this.uiElements.turnBannerLabel.textContent = players.length > 1
                ? `${name}'s Turn — Move with WASD/Arrows`
                : `Your Turn — Move with WASD/Arrows`;
            this.uiElements.turnBanner.classList.remove('npc');
        } else {
            this.uiElements.turnBannerLabel.textContent = 'City Moving…';
            this.uiElements.turnBanner.classList.add('npc');
        }

        this.uiElements.turnBanner.classList.remove('hidden');
    }

    /**
     * Apply or remove the low-time pulse animation and emit warning toasts at thresholds.
     */
    applyLowTimeWarning() {
        if (!this.uiElements.turnNumber || !this.turnManager) return;

        const player = (window.game && typeof window.game.getActivePlayer === 'function')
            ? window.game.getActivePlayer()
            : null;

        const turnsRemaining = player ? (player.turnsRemaining || 0) : 0;

        if (turnsRemaining > 0 && turnsRemaining <= 5) {
            this.uiElements.turnNumber.classList.add('low-time');
        } else {
            this.uiElements.turnNumber.classList.remove('low-time');
        }

        if (!this._timeWarningsShown) this._timeWarningsShown = new Set();

        const thresholds = [
            { value: 10, label: '10 turns left — pace yourself!', kind: 'warning' },
            { value: 5,  label: '⏰ 5 turns left — get moving!',    kind: 'danger' },
            { value: 1,  label: '🚨 LAST TURN — don\'t miss work!', kind: 'danger' },
        ];

        for (const t of thresholds) {
            if (turnsRemaining === t.value && !this._timeWarningsShown.has(t.value)) {
                this.showToast(t.label, t.kind, 3500);
                this._timeWarningsShown.add(t.value);
            }
        }
    }

    /**
     * Show a transient toast notification.
     * @param {string} message
     * @param {string} kind - 'info' | 'warning' | 'danger' | 'success'
     * @param {number} durationMs
     */
    showToast(message, kind = 'info', durationMs = 3500) {
        if (!this.uiElements.toastContainer || !message) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${kind}`;
        toast.textContent = message;

        // CSS reads --toast-fade-delay; total visible time = duration - 400ms fade
        const fadeDelay = Math.max(0, durationMs - 400);
        toast.style.setProperty('--toast-fade-delay', `${fadeDelay}ms`);

        this.uiElements.toastContainer.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode === this.uiElements.toastContainer) {
                this.uiElements.toastContainer.removeChild(toast);
            }
        }, durationMs + 50);
    }

    /**
     * Convert turn number into commute time text (7:00 AM to 9:00 AM)
     * @param {number} currentTurn
     * @returns {string}
     */
    getCurrentCommuteTimeText(currentTurn) {
        const maxTurns = (this.turnManager && this.turnManager.config && this.turnManager.config.maxTurns)
            ? this.turnManager.config.maxTurns
            : 1;

        const progress = Math.min(Math.max(currentTurn / maxTurns, 0), 1);
        const totalMinutes = Math.round(progress * 120);
        const minutesSinceMidnight = 7 * 60 + totalMinutes;
        const hour24 = Math.floor(minutesSinceMidnight / 60);
        const minute = minutesSinceMidnight % 60;
        const hour12 = ((hour24 + 11) % 12) + 1;
        const minuteText = minute.toString().padStart(2, '0');

        return `${hour12}:${minuteText} AM`;
    }

    /**
     * Update roadblock counter display
     */
    updateBlockCounter() {
        if (!this.uiElements.blockCounter) return;

        const specialAgent = this.turnManager.currentSpecialAgent;
        const charges = specialAgent ? specialAgent.abilityCharges : 0;
        const canUse = specialAgent && specialAgent.canUseAbility && specialAgent.canUseAbility();
        const blocksAvailable = Math.max(charges, 0);

        this.uiElements.blockCounter.textContent = `(${blocksAvailable}/1)`;

        // Disable button if no ability charges left
        if (!canUse || this.turnManager.playerBlockUsed) {
            this.uiElements.placeRoadblockBtn.disabled = true;
            this.uiElements.placeRoadblockBtn.style.opacity = '0.5';
        } else {
            this.uiElements.placeRoadblockBtn.disabled = false;
            this.uiElements.placeRoadblockBtn.style.opacity = '1';
        }
    }

    /**
     * Update special agent status UI
     */
    updateSpecialAgentStatus() {
        const specialAgent = this.turnManager.currentSpecialAgent;

        if (this.uiElements.specialAgentName) {
            if (specialAgent) {
                this.uiElements.specialAgentName.textContent = `Agent ${parseInt(specialAgent.id, 10) + 1}`;
            } else {
                this.uiElements.specialAgentName.textContent = 'None';
            }
        }

        if (this.uiElements.specialAgentCountdown) {
            const turns = Math.max(this.turnManager.turnsUntilNextRotation || 0, 0);
            this.uiElements.specialAgentCountdown.textContent = turns.toString();
        }
    }

    /**
     * Update game status badge
     * @param {string} status - 'ready', 'playing', or 'gameover'
     */
    updateGameStatus(status) {
        const statusText = {
            'ready': 'Ready',
            'playing': 'Playing',
            'gameover': 'Game Over'
        };

        this.uiElements.statusText.textContent = statusText[status] || status;
        
        // Update status class for color coding
        this.uiElements.gameStatus.className = `status-${status}`;
    }

    /**
     * Rebuild agent list HTML with current agent states
     */
    updateAgentList() {
        // Clear existing list
        this.uiElements.agentList.innerHTML = '';

        const activeIndex = (window.game && window.game.currentPlayerIndex) || 0;
        const playerAgents = this.agents.filter(a => a.isPlayerControlled);

        if (playerAgents.length === 0) {
            return;
        }

        // Show active player banner only for multiplayer
        if (playerAgents.length > 1) {
            const activePlayers = playerAgents.filter(a => a.status === Agent.STATUS.ACTIVE);
            const activePlayer = activePlayers.length > 0
                ? activePlayers[activeIndex % activePlayers.length]
                : playerAgents[0];

            const banner = document.createElement('div');
            banner.className = 'active-player-banner';
            banner.textContent = `${activePlayer.name}'s Turn`;
            this.uiElements.agentList.appendChild(banner);
        }

        // Render all player cards
        playerAgents.forEach((player, i) => {
            const card = this.createAgentCard(player, i);

            // Highlight active player card in multiplayer
            if (playerAgents.length > 1) {
                const activePlayers = playerAgents.filter(a => a.status === Agent.STATUS.ACTIVE);
                if (activePlayers.length > 0 && i === (activeIndex % activePlayers.length)) {
                    card.classList.add('is-active-turn');
                }
            }

            this.uiElements.agentList.appendChild(card);
        });
    }

    /**
     * Create HTML element for a single agent card
     * @param {Agent} agent - The agent to display
     * @param {number} index - Agent index
     * @returns {HTMLElement} Agent card element
     */
    createAgentCard(agent, index) {
        const card = document.createElement('div');
        card.className = `agent-card status-${agent.status.toLowerCase()}`;
        const displayName = agent.name || (agent.isPlayerControlled ? 'Player' : `Agent ${index + 1}`);

        // Determine status badge text and class
        let statusClass = 'active';
        let statusText = agent.status;
        
        if (agent.status === 'ARRIVED') {
            statusClass = 'arrived';
            statusText = 'Arrived';
        } else if (agent.status === 'FAILED') {
            statusClass = 'failed';
            statusText = 'Failed';
        } else if (agent.status === 'ACTIVE') {
            statusClass = 'active';
            statusText = 'Active';
        }

        // Calculate progress percentage (turns used / max turns)
        const defaultMaxTurns = (typeof window !== 'undefined' && window.GAME_CONSTANTS)
            ? window.GAME_CONSTANTS.TURN_LIMIT
            : 18;
        const maxTurns = (this.turnManager && this.turnManager.config && this.turnManager.config.maxTurns)
            ? this.turnManager.config.maxTurns
            : defaultMaxTurns;
        const turnsUsed = maxTurns - (agent.turnsRemaining || 0);
        const progressPercent = Math.min((turnsUsed / maxTurns) * 100, 100);
        const progressClass = agent.turnsRemaining < 5 ? 'low' : '';
        const roleClass = agent.isPlayerControlled ? 'player' : 'npc';
        const roleLabel = agent.isPlayerControlled ? 'PLAYER' : 'NPC';

        const abilityBadge = agent.hasAbility
            ? '<div class="agent-ability-badge">⚡ Special Agent</div>'
            : '';

        const injuryStatus = agent.isInjured
            ? '<div class="agent-injury-status">🏥 INJURED - Must visit hospital</div>'
            : '';

        let jailStatus = '';
        if (agent.isCriminal && agent.jailSentence > 0) {
            if (agent.isInJail) {
                jailStatus = `<div class="agent-jail-status">⚖️ IN JAIL - ${agent.jailSentence} turn${agent.jailSentence === 1 ? '' : 's'} remaining</div>`;
            } else {
                jailStatus = '<div class="agent-jail-status">⚖️ WANTED - Must visit jail</div>';
            }
        }

        let photoStatus = '';
        if (agent.takingPhoto && agent.photoTurnsRemaining > 0) {
            let bonusText = '';
            if (agent.skipNextTrafficJam) {
                bonusText = ' [🚗 Skip next jam]';
            }
            photoStatus = `<div class="agent-photo-status">📷 Taking Photo - ${agent.photoTurnsRemaining} turn${agent.photoTurnsRemaining === 1 ? '' : 's'}${bonusText}</div>`;
        }

        // Build card HTML
        card.innerHTML = `
            <div class="agent-header">
                <div class="agent-name">
                    <span class="agent-color-dot" style="background-color: ${agent.color};"></span>
                    ${displayName}
                    <span class="agent-role-badge ${roleClass}">${roleLabel}</span>
                </div>
                <div class="agent-status-badge ${statusClass}">${statusText}</div>
            </div>
            ${abilityBadge}
            ${injuryStatus}
            ${jailStatus}
            ${photoStatus}
            <div class="agent-info">
                <strong>Location:</strong> (${agent.currentLocation.x}, ${agent.currentLocation.y})
            </div>
            <div class="agent-info">
                <strong>Turns Left:</strong> ${agent.turnsRemaining || 0} / ${maxTurns}
            </div>
            ${this.getAgentTaskInfo(agent)}
            <div class="progress-bar-container">
                <div class="progress-bar ${progressClass}" style="width: ${progressPercent}%;"></div>
            </div>
        `;

        return card;
    }

    /**
     * Get agent task information HTML
     * @param {Agent} agent - The agent
     * @returns {string} HTML string for task info
     */
    getAgentTaskInfo(agent) {
        if (!agent.tasksQueue || agent.tasksQueue.length === 0) {
            return '<div class="agent-info"><strong>Task:</strong> Go directly to work</div>';
        }

        // Build checklist of all tasks
        let checklist = '<div class="agent-task-checklist"><strong>Tasks:</strong><ul>';
        
        for (const task of agent.tasksQueue) {
            const checkbox = task.completed ? '☑' : '☐';
            const taskName = this.formatTaskName(task);
            const classes = task.completed ? 'completed' : 'pending';
            checklist += `<li class="task-item ${classes}">${checkbox} ${taskName}</li>`;
        }

        // Always show job as final task
        const reachedOffice = agent.arrivedAtJob === true || agent.status === 'ARRIVED';
        const jobCheckbox = reachedOffice ? '☑' : '☐';
        const jobClasses = reachedOffice ? 'completed' : 'pending';
        const themeForJob = (typeof document !== 'undefined' && document.body && document.body.dataset.theme)
            || (typeof window !== 'undefined' && window.GAME_THEME)
            || 'classic';
        let jobLabel = 'Reach office';
        if (themeForJob === 'medieval')   jobLabel = 'Report to the keep';
        if (themeForJob === 'futuristic') jobLabel = 'Report to megacorp tower';
        checklist += `<li class="task-item ${jobClasses}">${jobCheckbox} ${jobLabel}</li>`;

        checklist += '</ul></div>';
        return checklist;
    }

    /**
     * Update tile inspector with tile information
     * @param {number} x - Tile x coordinate
     * @param {number} y - Tile y coordinate
     */
    updateTileInspector(x, y) {
        const tile = this.board.getTile(x, y);
        if (!tile) {
            this.hideTileInspector();
            return;
        }

        // Update position
        this.uiElements.tilePosition.textContent = `(${x}, ${y})`;

        // Update type
        this.uiElements.tileType.textContent = tile.type || 'UNKNOWN';

        // Update congestion with color coding
        const congestion = tile.congestion || 0;
        this.uiElements.tileCongestion.textContent = `${congestion} / 5`;
        this.uiElements.tileCongestion.setAttribute('data-level', congestion.toString());

        // Update blocked status
        this.uiElements.tileBlocked.textContent = tile.isBlocked ? 'Yes ⚠️' : 'No';
        this.uiElements.tileBlocked.style.color = tile.isBlocked ? '#ff6b6b' : '#51cf66';

        // Find agents on this tile
        const agentsOnTile = this.agents.filter(agent => 
            agent.currentLocation.x === x && agent.currentLocation.y === y
        );

        if (agentsOnTile.length === 0) {
            this.uiElements.tileAgents.textContent = 'None';
        } else {
            this.uiElements.tileAgents.innerHTML = agentsOnTile.map((agent, idx) => {
                const agentIndex = this.agents.indexOf(agent) + 1;
                const displayName = agent.isPlayerControlled ? 'Player' : `Agent ${agentIndex}`;
                return `<span class="agent-chip" style="border-color: ${agent.color};">${displayName}</span>`;
            }).join('');
        }

        // Show inspector
        this.showTileInspector();
    }

    /**
     * Show tile inspector panel with fade-in animation
     */
    showTileInspector() {
        this.uiElements.tileInspector.style.display = 'block';
        // Force reflow for animation
        this.uiElements.tileInspector.offsetHeight;
        this.uiElements.tileInspector.classList.remove('hidden');
    }

    /**
     * Hide tile inspector panel with fade-out animation
     */
    hideTileInspector() {
        this.uiElements.tileInspector.classList.add('hidden');
        setTimeout(() => {
            if (this.uiElements.tileInspector.classList.contains('hidden')) {
                this.uiElements.tileInspector.style.display = 'none';
            }
        }, 300);
    }

    /**
     * Handle end turn button click
     */
    onEndTurnClick() {
        if (this.keyboardOnlyMode) {
            return;
        }

        // Check if game is running
        if (!this.turnManager.gameRunning) {
            return;
        }

        // Check if game is already over
        if (this.turnManager.gameFinished) {
            return;
        }

        // Execute turn
        this.turnManager.executeTurn();

        // Update UI displays
        this.updateTurnDisplay();
        this.updateAgentList();

        // Update game status
        if (this.turnManager.gameFinished) {
            this.updateGameStatus('gameover');
            this.showGameOver();
        } else {
            this.updateGameStatus('playing');
        }

        // Notify renderer to update (if exists)
        if (window.gameRenderer && typeof window.gameRenderer.updateAgents === 'function') {
            window.gameRenderer.updateAgents(this.agents);
        }
        if (window.gameRenderer && typeof window.gameRenderer.updateTraffic === 'function') {
            window.gameRenderer.updateTraffic(this.board);
        }
    }

    /**
     * Toggle roadblock placement mode
     */
    onRoadblockToggle() {
        if (this.keyboardOnlyMode) {
            return;
        }

        // Toggle via input manager if available
        if (window.gameInputManager && window.gameInputManager.toggleBlockMode) {
            const isActive = window.gameInputManager.toggleBlockMode();
            
            if (isActive) {
                this.uiElements.placeRoadblockBtn.classList.add('active');
            } else {
                this.uiElements.placeRoadblockBtn.classList.remove('active');
            }
        } else {
            // Fallback to local toggle
            this.roadblockMode = !this.roadblockMode;
            
            if (this.roadblockMode) {
                this.uiElements.placeRoadblockBtn.classList.add('active');
            } else {
                this.uiElements.placeRoadblockBtn.classList.remove('active');
            }
        }
    }

    /**
     * Place or remove roadblock at tile
     * @param {number} x - Tile x coordinate
     * @param {number} y - Tile y coordinate
     */
    placeRoadblock(x, y) {
        // Use TurnManager's placePlayerBlock method
        if (this.turnManager && this.turnManager.placePlayerBlock) {
            const success = this.turnManager.placePlayerBlock(x, y);
            
            if (success) {
                // Update block counter
                this.updateBlockCounter();
                
                // Turn off roadblock mode after placing
                if (window.gameInputManager && window.gameInputManager.blockPlacementMode) {
                    window.gameInputManager.toggleBlockMode();
                    this.uiElements.placeRoadblockBtn.classList.remove('active');
                }
            }
        } else {
            // Fallback to old method
            const tile = this.board.getTile(x, y);
            if (!tile) return;

            tile.isBlocked = !tile.isBlocked;
        }

        // Update tile inspector if it's showing this tile
        const currentPosition = this.uiElements.tilePosition.textContent;
        if (currentPosition === `(${x}, ${y})`) {
            this.updateTileInspector(x, y);
        }

        // Update renderer
        if (window.gameRenderer && typeof window.gameRenderer.updateTraffic === 'function') {
            window.gameRenderer.updateTraffic(this.board);
        }
    }

    /**
     * Check if roadblock mode is active
     * @returns {boolean} True if roadblock mode is on
     */
    isRoadblockMode() {
        if (window.gameInputManager && window.gameInputManager.blockPlacementMode !== undefined) {
            return window.gameInputManager.blockPlacementMode;
        }
        return this.roadblockMode;
    }

    /**
     * Update task checklist panel
     */
    updateTaskChecklist() {
        const checklistPanel = document.getElementById('taskChecklist');
        if (!checklistPanel) return;

        checklistPanel.innerHTML = '';

        const player = this.agents[0];
        if (!player || !player.tasksQueue || player.tasksQueue.length === 0) {
            checklistPanel.innerHTML = '<div class="agent-info"><strong>Task:</strong> Go directly to work</div>';
            return;
        }

        const playerSection = document.createElement('div');
        playerSection.className = 'checklist-agent-section';
        playerSection.innerHTML = '<div class="checklist-agent-name">Player Tasks</div>';

        const list = document.createElement('ul');
        list.className = 'checklist-list';

        player.tasksQueue.forEach((task) => {
            const item = document.createElement('li');
            item.className = `checklist-item ${task.completed ? 'completed' : 'active'}`;

            const icon = task.completed ? '✅' : '⏳';
            const taskName = this.formatTaskName(task);

            item.innerHTML = `<span class="checklist-icon">${icon}</span> <span>${taskName}</span>`;
            list.appendChild(item);
        });

        playerSection.appendChild(list);
        checklistPanel.appendChild(playerSection);
    }

    /**
     * Update statistics panel
     */
    updateStatistics() {
        // Total tasks completed
        const totalTasksCompleted = this.agents.reduce((sum, agent) => sum + (agent.completedTasks?.length || 0), 0);
        const statTotalTasks = document.getElementById('statTotalTasks');
        if (statTotalTasks) {
            statTotalTasks.textContent = totalTasksCompleted;
        }

        // Photo delays
        const photoDelayTurns = this.agents.reduce((sum, agent) => {
            return sum + (agent.photoTurnsRemaining || 0);
        }, 0);
        const statPhotoDelays = document.getElementById('statPhotoDelays');
        if (statPhotoDelays) {
            statPhotoDelays.textContent = `${photoDelayTurns} turns`;
        }

        // Congestion incidents
        let congestionIncidents = 0;
        for (let y = 0; y < this.board.height; y++) {
            for (let x = 0; x < this.board.width; x++) {
                const tile = this.board.getTile(x, y);
                if (tile && tile.congestion > 0) {
                    congestionIncidents++;
                }
            }
        }
        const statCongestionIncidents = document.getElementById('statCongestionIncidents');
        if (statCongestionIncidents) {
            statCongestionIncidents.textContent = congestionIncidents;
        }

        // Special abilities used
        const abilitiesUsed = this.agents.reduce((sum, agent) => {
            return sum + (agent.hasAbility && agent.abilityCharges === 0 ? 1 : 0);
        }, 0);
        const statAbilitiesUsed = document.getElementById('statAbilitiesUsed');
        if (statAbilitiesUsed) {
            statAbilitiesUsed.textContent = abilitiesUsed;
        }
    }

    /**
     * Update turn timeline progress bar
     */
    updateTurnTimeline() {
        const currentTurn = this.turnManager.currentTurn || 0;
        const maxTurns = (this.turnManager && this.turnManager.config && this.turnManager.config.maxTurns)
            ? this.turnManager.config.maxTurns
            : 50;

        const timelineProgress = document.getElementById('timelineProgress');
        const timelineElapsed = document.getElementById('timelineElapsed');
        const timelineTotal = document.getElementById('timelineTotal');

        if (timelineProgress) {
            const percentComplete = (currentTurn / maxTurns) * 100;
            timelineProgress.style.width = Math.min(percentComplete, 100) + '%';
        }

        if (timelineElapsed) {
            timelineElapsed.textContent = currentTurn;
        }

        if (timelineTotal) {
            timelineTotal.textContent = maxTurns;
        }
    }

    /**
     * Show tooltip on hover over tiles or UI elements
     * @param {Object} event - Mouse event
     * @param {string} tooltipText - Text to display
     */
    showTooltip(event, tooltipText) {
        // Remove existing tooltip
        const existingTooltip = document.querySelector('.tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        if (!tooltipText) return;

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = tooltipText;
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY + 10) + 'px';

        document.body.appendChild(tooltip);
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    /**
     * Update all UI panels at once
     */
    updateAllPanels() {
        this.updateTurnDisplay();
        this.updateAgentList();
        this.updateTaskChecklist();
        this.updateStatistics();
        this.updateTurnTimeline();
    }

    /**
     * Format task name for display. Accepts either a raw task-type string
     * or a full task object so we can branch on subtypes (e.g. medicine vs
     * injury-driven hospital visit).
     * @param {string|Object} taskOrType
     * @returns {string} Formatted task name with icon
     */
    formatTaskName(taskOrType) {
        const task = (typeof taskOrType === 'string') ? null : taskOrType;
        const taskType = task ? task.type : taskOrType;

        const theme = (typeof document !== 'undefined' && document.body && document.body.dataset.theme)
            || (typeof window !== 'undefined' && window.GAME_THEME)
            || 'classic';

        if (taskType === 'HOSPITAL') {
            if (task && task.subtype === 'MEDICINE') {
                if (theme === 'medieval')   return '🌿 Fetch herbs from monastery';
                if (theme === 'futuristic') return '💉 Pick up nanomeds at med-bay';
                return '💊 Pick up medicine';
            }
            if (task && task.isHospitalTask) {
                if (theme === 'medieval')   return '🌿 Mend wounds at monastery';
                if (theme === 'futuristic') return '🩺 Repair injuries at med-bay';
                return '🏥 Visit hospital (injury)';
            }
            if (theme === 'medieval')   return '🌿 Visit monastery';
            if (theme === 'futuristic') return '🩺 Visit med-bay';
            return '🏥 Visit hospital';
        }
        if (taskType === 'LANDMARK') {
            if (theme === 'medieval')   return '📜 Pay respects at the shrine';
            if (theme === 'futuristic') return '🛰️ Scan the data spire';
            return '📷 Take photo at landmark';
        }
        if (taskType === 'CAFE') {
            if (theme === 'medieval')   return '🍺 Drink ale at the tavern';
            if (theme === 'futuristic') return '⚡ Synth-coffee at the neon bar';
            return '☕ Grab coffee at cafe';
        }
        if (taskType === 'JAIL') {
            if (theme === 'medieval')   return '⛓️ Serve sentence in the dungeon';
            if (theme === 'futuristic') return '🔒 Detention block sentence';
            return '⚖️ Serve jail time';
        }

        const fallbacks = {
            'GAS_STATION': '⛽ Gas Station',
            'POSTAL_OFFICE': '📮 Postal Office',
            'DELIVER_PACKAGE': '📦 Deliver Package',
            'PICK_UP_DRY_CLEANING': '🧥 Pick Up Dry Cleaning',
            'MEET_FRIEND': '👥 Meet Friend',
        };
        return fallbacks[taskType] || taskType;
    }

    /**
     * Show game over screen with results
     */
    showGameOver() {
        const player = this.agents[0] || null;
        const playerSucceeded = player && player.status === 'ARRIVED';
        const playerFailed = player && player.status === 'FAILED';

        const theme = (typeof document !== 'undefined' && document.body && document.body.dataset.theme)
            || (typeof window !== 'undefined' && window.GAME_THEME)
            || 'classic';

        let resultTitle;
        if (playerSucceeded) {
            resultTitle = 'You Won!';
        } else if (theme === 'medieval') {
            resultTitle = "You've Been Executed";
        } else if (theme === 'futuristic') {
            resultTitle = "You've Been Decommissioned";
        } else {
            resultTitle = "You're Fired!";
        }

        // Calculate average congestion
        let congestionSum = 0;
        let tileCount = 0;
        for (let y = 0; y < this.board.height; y++) {
            for (let x = 0; x < this.board.width; x++) {
                const tile = this.board.getTile(x, y);
                if (tile) {
                    congestionSum += tile.congestion || 0;
                    tileCount++;
                }
            }
        }
        const avgCongestion = tileCount > 0 ? (congestionSum / tileCount) : 0;

        // Tasks completed
        const tasksCompleted = this.agents.reduce((sum, agent) => sum + (agent.completedTasks?.length || 0), 0);

        // Update overlay content
        if (this.uiElements.gameOverTitle) {
            this.uiElements.gameOverTitle.textContent = resultTitle;
            this.uiElements.gameOverTitle.classList.toggle('win', resultTitle === 'You Won!');
            this.uiElements.gameOverTitle.classList.toggle('fail', playerFailed);
        }

        if (this.uiElements.gameOverTurns) {
            this.uiElements.gameOverTurns.textContent = this.turnManager.currentTurn || 0;
        }
        if (this.uiElements.gameOverSuccess) {
            this.uiElements.gameOverSuccess.textContent = playerSucceeded ? '1' : '0';
        }
        if (this.uiElements.gameOverFail) {
            this.uiElements.gameOverFail.textContent = playerFailed ? '1' : '0';
        }
        if (this.uiElements.gameOverCongestion) {
            this.uiElements.gameOverCongestion.textContent = avgCongestion.toFixed(2);
        }
        if (this.uiElements.gameOverTasks) {
            this.uiElements.gameOverTasks.textContent = tasksCompleted;
        }

        // Show overlay
        if (this.uiElements.gameOverOverlay) {
            this.uiElements.gameOverOverlay.classList.remove('hidden');
        }

        // Disable inputs
        if (this.uiElements.endTurnBtn) {
            this.uiElements.endTurnBtn.disabled = true;
        }
        if (this.uiElements.placeRoadblockBtn) {
            this.uiElements.placeRoadblockBtn.disabled = true;
        }

        if (window.gameInputManager && window.gameInputManager.blockPlacementMode) {
            window.gameInputManager.toggleBlockMode();
        }

        document.body.classList.add('game-over');
    }

    /**
     * Start the game
     */
    startGame() {
        
        // Start turn manager
        this.turnManager.start();

        // Update UI
        this.updateGameStatus('playing');
        this.updateTurnDisplay();
        this.updateAgentList();

        // Enable end turn button only when not using keyboard-only mode
        if (!this.keyboardOnlyMode) {
            this.uiElements.endTurnBtn.disabled = false;
        }

    }

    /**
     * Reset game state
     */
    resetGame() {
        if (this.autoplayInterval) {
            clearInterval(this.autoplayInterval);
            this.autoplayInterval = null;
        }
        this.isAutoplayActive = false;
        location.reload();
    }

    /**
     * Toggle autoplay on/off
     */
    toggleAutoplay() {
        if (this.keyboardOnlyMode) {
            return;
        }

        this.isAutoplayActive = !this.isAutoplayActive;
        
        if (this.uiElements.autoplayBtn) {
            const icon = this.uiElements.autoplayBtn.querySelector('.icon');
            const label = this.uiElements.autoplayBtn.querySelector('.label');
            
            if (this.isAutoplayActive) {
                this.uiElements.autoplayBtn.classList.add('playing');
                this.uiElements.autoplayBtn.classList.remove('paused');
                if (icon) icon.textContent = '⏸';
                if (label) label.textContent = 'Pause';
                
                // Start autoplay loop if not already running
                if (!this.autoplayInterval) {
                    this.startAutoplayLoop();
                }
            } else {
                this.uiElements.autoplayBtn.classList.remove('playing');
                this.uiElements.autoplayBtn.classList.add('paused');
                if (icon) icon.textContent = '▶️';
                if (label) label.textContent = 'Start';
                
                // Stop autoplay loop
                if (this.autoplayInterval) {
                    clearInterval(this.autoplayInterval);
                    this.autoplayInterval = null;
                }
            }
        }
    }

    /**
     * Update camera zoom from slider input
     * @param {number} zoomDistance
     */
    updateZoom(zoomLevel) {
        if (!Number.isFinite(zoomLevel)) {
            return;
        }

        const clampedLevel = Math.min(80, Math.max(20, zoomLevel));
        const zoomDistance = 100 - clampedLevel;

        if (this.uiElements.zoomDisplay) {
            this.uiElements.zoomDisplay.textContent = clampedLevel.toString();
        }

        if (window.gameRenderer && typeof window.gameRenderer.setZoomDistance === 'function') {
            window.gameRenderer.setZoomDistance(zoomDistance);
        }
    }

    /**
     * Update autoplay speed (1-10 scale)
     */
    updateSpeed(speed) {
        this.autoplaySpeed = Math.max(1, Math.min(10, speed));
        
        if (this.uiElements.speedDisplay) {
            this.uiElements.speedDisplay.textContent = this.autoplaySpeed + 'x';
        }
        
        if (this.uiElements.speedSlider) {
            this.uiElements.speedSlider.value = this.autoplaySpeed;
        }
        
        // Restart autoplay loop with new speed if playing
        if (this.isAutoplayActive) {
            if (this.autoplayInterval) {
                clearInterval(this.autoplayInterval);
            }
            this.startAutoplayLoop();
        }
    }

    /**
     * Start the autoplay loop
     */
    startAutoplayLoop() {
        if (!this.isAutoplayActive) return;
        
        // Speed 5 = normal (1000ms), Speed 10 = 2x (500ms), Speed 1 = 5x slower (5000ms)
        const speedMultiplier = 11 - this.autoplaySpeed; // Reverse: higher speed value = lower multiplier
        const delayMs = speedMultiplier * 200; // Base 200ms per speed unit
        
        this.autoplayInterval = setInterval(() => {
            if (this.isAutoplayActive && this.uiElements.endTurnBtn && !this.uiElements.endTurnBtn.disabled) {
                this.uiElements.endTurnBtn.click();
            }
        }, delayMs);
    }

    /**
     * Toggle legend minimize/expand
     */
    toggleLegendMinimize() {
        if (this.uiElements.mapLegend) {
            const isMinimized = this.uiElements.mapLegend.classList.toggle('minimized');
            
            if (this.uiElements.legendMinimizeBtn) {
                this.uiElements.legendMinimizeBtn.textContent = isMinimized ? '✕' : '−';
                this.uiElements.legendMinimizeBtn.title = isMinimized ? 'Expand legend' : 'Minimize legend';
            }
        }
    }
}

// Expose to global scope for browser usage
if (typeof window !== 'undefined') {
    window.UIController = UIController;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}
