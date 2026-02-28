/**
 * DebugMode.js - Development debug visualization and logging
 * 
 * Handles:
 * - FPS counter
 * - Agent path visualization
 * - Tile coordinate labels
 * - Congestion value displays
 * - Graph connection visualization
 * - Pathfinding decision logging
 */

class DebugMode {
    /**
     * Constructor
     * @param {Renderer} renderer - Renderer instance
     * @param {Board} board - Board instance
     * @param {Array} agents - Array of agent instances
     */
    constructor(renderer, board, agents) {
        if (!renderer) {
            throw new Error('Renderer required for DebugMode');
        }
        if (!board) {
            throw new Error('Board required for DebugMode');
        }

        this.renderer = renderer;
        this.board = board;
        this.agents = agents || [];

        // Debug state
        this.enabled = false;
        this.showPaths = true;
        this.showLabels = true;
        this.showCongestion = true;
        this.showGraph = true;
        this.logPathfinding = true;

        // FPS tracking
        this.frameCount = 0;
        this.lastTime = Date.now();
        this.fps = 0;

        // Debug meshes
        this.pathLines = new Map();         // Key: agent.id, Value: THREE.Line
        this.coordinateLabels = new Map(); // Key: "x,y", Value: THREE.Sprite
        this.congestionLabels = new Map(); // Key: "x,y", Value: THREE.Sprite
        this.graphLines = new Map();        // Key: "x,y_nx,ny", Value: THREE.Line
        this.debugGroup = null;

        // Initialize debug group in scene
        this.debugGroup = new THREE.Group();
        this.debugGroup.name = 'DebugGroup';
        this.renderer.scene.add(this.debugGroup);
    }

    /**
     * Toggle debug mode on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        this.debugGroup.visible = this.enabled;

        if (this.enabled) {
            console.log('%c[DEBUG MODE ENABLED]', 'color: #00ff00; font-weight: bold; font-size: 14px');
            console.log('Press D to toggle debug mode');
            console.log('Controls:');
            console.log('  P - Toggle path visualization');
            console.log('  L - Toggle coordinate labels');
            console.log('  C - Toggle congestion display');
            console.log('  G - Toggle graph visualization');
            console.log('  X - Toggle pathfinding logging');
            this.render();
        } else {
            console.log('%c[DEBUG MODE DISABLED]', 'color: #ff0000; font-weight: bold; font-size: 14px');
            this.clear();
        }
    }

    /**
     * Clear all debug visualizations
     */
    clear() {
        // Clear path lines
        this.pathLines.forEach(line => this.debugGroup.remove(line));
        this.pathLines.clear();

        // Clear labels
        this.coordinateLabels.forEach(label => this.debugGroup.remove(label));
        this.coordinateLabels.clear();

        this.congestionLabels.forEach(label => this.debugGroup.remove(label));
        this.congestionLabels.clear();

        // Clear graph lines
        this.graphLines.forEach(line => this.debugGroup.remove(line));
        this.graphLines.clear();
    }

    /**
     * Render all debug visualizations
     */
    render() {
        if (!this.enabled) return;

        this.updateFPS();
        this.displayFPS();

        if (this.showPaths) {
            this.visualizePaths();
        }

        if (this.showLabels) {
            this.visualizeCoordinates();
        }

        if (this.showCongestion) {
            this.visualizeCongestion();
        }

        if (this.showGraph) {
            this.visualizeGraph();
        }
    }

    /**
     * Update FPS counter
     */
    updateFPS() {
        this.frameCount++;
        const currentTime = Date.now();
        const elapsed = currentTime - this.lastTime;

        if (elapsed >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / elapsed);
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }

    /**
     * Display FPS in top-left corner
     */
    displayFPS() {
        let fpsDisplay = document.getElementById('debugFPS');

        if (!fpsDisplay) {
            fpsDisplay = document.createElement('div');
            fpsDisplay.id = 'debugFPS';
            fpsDisplay.style.cssText = `
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.7);
                color: #00ff00;
                padding: 8px 12px;
                font-family: monospace;
                font-size: 12px;
                border: 1px solid #00ff00;
                border-radius: 4px;
                z-index: 1000;
                pointer-events: none;
            `;
            document.body.appendChild(fpsDisplay);
        }

        fpsDisplay.textContent = `FPS: ${this.fps}`;
    }

    /**
     * Visualize paths for all agents
     */
    visualizePaths() {
        this.pathLines.forEach(line => this.debugGroup.remove(line));
        this.pathLines.clear();

        const colors = [
            0xff0000, // Red
            0x00ff00, // Green
            0x0000ff, // Blue
            0xffff00, // Yellow
            0xff00ff, // Magenta
            0x00ffff, // Cyan
        ];

        this.agents.forEach((agent, index) => {
            if (!agent.path || agent.path.length === 0) return;

            const color = colors[index % colors.length];
            const points = agent.path.map(pos => {
                return new THREE.Vector3(pos.x, 0.3, pos.y);
            });

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: color,
                linewidth: 2,
                transparent: true,
                opacity: 0.8,
            });

            const line = new THREE.Line(geometry, material);
            line.name = `path_${agent.id}`;
            this.debugGroup.add(line);
            this.pathLines.set(agent.id, line);

            // Log path info if logging enabled
            if (this.logPathfinding && agent.path.length > 0) {
                console.log(
                    `%c[Agent ${agent.id}] Path: ${agent.path.length} steps from (${agent.x},${agent.y})`,
                    'color: #ffaa00; font-size: 11px'
                );
            }
        });
    }

    /**
     * Visualize tile coordinates as text labels
     */
    visualizeCoordinates() {
        this.coordinateLabels.forEach(label => this.debugGroup.remove(label));
        this.coordinateLabels.clear();

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Create a texture for all coordinates at once using a atlas approach
        // For now, render a subset to avoid performance issues
        const gridSize = this.board.gridSize || 16;
        const sampleRate = 2; // Show every 2nd tile to reduce clutter

        for (let y = 0; y < gridSize; y += sampleRate) {
            for (let x = 0; x < gridSize; x += sampleRate) {
                // Create canvas texture for this label
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, 64, 64);

                ctx.fillStyle = '#00ff00';
                ctx.font = 'Bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${x},${y}`, 32, 32);

                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.SpriteMaterial({ map: texture });
                const sprite = new THREE.Sprite(material);

                sprite.position.set(x, 0.5, y);
                sprite.scale.set(0.5, 0.5, 1);
                sprite.name = `label_${x}_${y}`;

                this.debugGroup.add(sprite);
                this.coordinateLabels.set(`${x},${y}`, sprite);
            }
        }
    }

    /**
     * Visualize congestion values on tiles
     */
    visualizeCongestion() {
        this.congestionLabels.forEach(label => this.debugGroup.remove(label));
        this.congestionLabels.clear();

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const gridSize = this.board.gridSize || 16;

        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const tile = this.board.getTile(x, y);
                if (!tile || tile.congestion === 0) continue;

                // Color based on congestion level
                const congestionPercent = Math.min(tile.congestion / 5, 1);
                const hue = (1 - congestionPercent) * 120; // Green to red
                const color = `hsl(${hue}, 100%, 50%)`;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(0, 0, 64, 64);

                ctx.fillStyle = color;
                ctx.font = 'Bold 28px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(tile.congestion, 32, 32);

                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.SpriteMaterial({ map: texture });
                const sprite = new THREE.Sprite(material);

                sprite.position.set(x, 0.7, y);
                sprite.scale.set(0.4, 0.4, 1);
                sprite.name = `congestion_${x}_${y}`;

                this.debugGroup.add(sprite);
                this.congestionLabels.set(`${x},${y}`, sprite);
            }
        }
    }

    /**
     * Visualize graph connections as lines
     */
    visualizeGraph() {
        this.graphLines.forEach(line => this.debugGroup.remove(line));
        this.graphLines.clear();

        if (!this.board.graph) {
            console.warn('Board graph not available');
            return;
        }

        const material = new THREE.LineBasicMaterial({
            color: 0x0088ff,
            linewidth: 1,
            transparent: true,
            opacity: 0.4,
        });

        const gridSize = this.board.gridSize || 16;

        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const key = `${x},${y}`;
                const neighbors = this.board.graph[key] || [];

                neighbors.forEach(neighbor => {
                    const edgeKey = `${key}_${neighbor.x},${neighbor.y}`;

                    // Avoid duplicate edges
                    if (this.graphLines.has(edgeKey)) return;

                    const points = [
                        new THREE.Vector3(x, 0.2, y),
                        new THREE.Vector3(neighbor.x, 0.2, neighbor.y),
                    ];

                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, material);
                    line.name = `graph_edge_${edgeKey}`;

                    this.debugGroup.add(line);
                    this.graphLines.set(edgeKey, line);
                });
            }
        }
    }

    /**
     * Log pathfinding decision
     * @param {Object} data - Decision data {agent, decision, details}
     */
    logPathfindingDecision(data) {
        if (!this.enabled || !this.logPathfinding) return;

        const { agent, decision, details } = data;
        const timestamp = new Date().toLocaleTimeString();

        console.log(
            `%c[${timestamp}] Agent ${agent.id}: ${decision}`,
            'color: #ffaa00; font-size: 11px',
            details
        );
    }

    /**
     * Handle debug key presses
     * @param {string} key - The key that was pressed
     */
    handleKeyPress(key) {
        const lowerKey = key.toLowerCase();

        switch (lowerKey) {
            case 'd':
                this.toggle();
                break;
            case 'p':
                if (this.enabled) {
                    this.showPaths = !this.showPaths;
                    console.log(`Path visualization ${this.showPaths ? 'enabled' : 'disabled'}`);
                    this.clear();
                    this.render();
                }
                break;
            case 'l':
                if (this.enabled) {
                    this.showLabels = !this.showLabels;
                    console.log(`Coordinate labels ${this.showLabels ? 'enabled' : 'disabled'}`);
                    this.clear();
                    this.render();
                }
                break;
            case 'c':
                if (this.enabled) {
                    this.showCongestion = !this.showCongestion;
                    console.log(`Congestion display ${this.showCongestion ? 'enabled' : 'disabled'}`);
                    this.clear();
                    this.render();
                }
                break;
            case 'g':
                if (this.enabled) {
                    this.showGraph = !this.showGraph;
                    console.log(`Graph visualization ${this.showGraph ? 'enabled' : 'disabled'}`);
                    this.clear();
                    this.render();
                }
                break;
            case 'x':
                if (this.enabled) {
                    this.logPathfinding = !this.logPathfinding;
                    console.log(`Pathfinding logging ${this.logPathfinding ? 'enabled' : 'disabled'}`);
                }
                break;
        }
    }

    /**
     * Get debug info for a specific position
     * @param {number} x - Grid X coordinate
     * @param {number} y - Grid Y coordinate
     * @returns {Object} Debug information
     */
    getTileDebugInfo(x, y) {
        const tile = this.board.getTile(x, y);
        if (!tile) return null;

        return {
            position: { x, y },
            type: tile.type,
            isWalkable: tile.isWalkable,
            congestion: tile.congestion,
            blocked: tile.blocked,
            blockTurnsRemaining: tile.blockTurnsRemaining,
            hasAgent: this.agents.some(a => a.x === x && a.y === y),
            neighbors: this.board.graph ? (this.board.graph[`${x},${y}`] || []) : [],
        };
    }
}
