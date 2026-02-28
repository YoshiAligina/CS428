/**
 * InputManager.js - User input and raycasting for tile interaction
 * 
 * Handles:
 * - Mouse interaction with 3D tiles using raycasting
 * - Tile hover detection
 * - Tile click detection
 * - Visual feedback for hovered tiles
 */

class InputManager {
    /**
     * Constructor
     * @param {Renderer} renderer - Renderer instance
     * @param {Board} board - Board instance
     * @param {DebugMode} debugMode - Optional DebugMode instance
     */
    constructor(renderer, board, debugMode = null) {
        if (!renderer) {
            throw new Error('Renderer required for InputManager');
        }
        if (!board) {
            throw new Error('Board required for InputManager');
        }

        this.renderer = renderer;
        this.board = board;
        this.debugMode = debugMode;

        // Raycasting for mouse interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Roadblock placement mode
        this.blockPlacementMode = false;

        // Tile interaction state
        this.selectedTile = null;    // Currently selected tile {x, y}
        this.hoveredTile = null;     // Currently hovered tile {x, y}

        // Visual feedback mesh
        this.hoverHighlight = null;

        // Event callbacks
        this.callbacks = {};

        // Keyboard state
        this.keys = {};

        // Initialize
        this.init();
    }

    /**
     * Initialize event listeners
     */
    init() {
        const canvas = this.renderer.canvas;

        // Mouse events
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e), false);
        canvas.addEventListener('click', (e) => this.onMouseClick(e), false);

        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e), false);
        document.addEventListener('keyup', (e) => this.onKeyUp(e), false);

        // Create hover highlight mesh
        this.createHoverHighlight();

    }

    /**
     * Create hover highlight visual feedback
     */
    createHoverHighlight() {
        // Create a glowing outline box for hover feedback
        const geometry = new THREE.BoxGeometry(1.05, 0.25, 1.05);
        const edges = new THREE.EdgesGeometry(geometry);
        
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            linewidth: 2,
        });

        this.hoverHighlight = new THREE.LineSegments(edges, material);
        this.hoverHighlight.visible = false;
        this.renderer.scene.add(this.hoverHighlight);

        // Also create a subtle glow plane
        const glowGeometry = new THREE.PlaneGeometry(1.0, 1.0);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
        });

        this.hoverGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.hoverGlow.rotation.x = -Math.PI / 2;
        this.hoverGlow.visible = false;
        this.renderer.scene.add(this.hoverGlow);
    }

    /**
     * Toggle roadblock placement mode
     * @returns {boolean} New state of block placement mode
     */
    toggleBlockMode() {
        this.blockPlacementMode = !this.blockPlacementMode;
        
        // Change cursor
        const canvas = this.renderer.canvas;
        if (this.blockPlacementMode) {
            canvas.style.cursor = 'crosshair';
        } else {
            canvas.style.cursor = 'default';
        }
        
        return this.blockPlacementMode;
    }

    /**
     * Register callback for input events
     * @param {string} event - Event name ('tileHover', 'tileClick', etc.)
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    /**
     * Emit event to callbacks
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    emit(event, data) {
        if (this.callbacks[event]) {
            for (let callback of this.callbacks[event]) {
                callback(data);
            }
        }
    }

    /**
     * Handle mouse move - update hovered tile
     * @param {MouseEvent} event - Mouse event
     */
    onMouseMove(event) {
        // Calculate normalized device coordinates (-1 to +1)
        const rect = this.renderer.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

        // Get all tile meshes as an array
        const tileMeshes = Array.from(this.renderer.tileMeshes.values());

        // Find intersected objects
        const intersects = this.raycaster.intersectObjects(tileMeshes, false);

        if (intersects.length > 0) {
            // Get the closest intersected tile
            const intersectedMesh = intersects[0].object;

            // Find which tile this mesh belongs to
            const tileCoords = this.findTileFromMesh(intersectedMesh);

            if (tileCoords) {
                // Check if hover changed
                if (!this.hoveredTile || 
                    this.hoveredTile.x !== tileCoords.x || 
                    this.hoveredTile.y !== tileCoords.y) {
                    
                    this.hoveredTile = tileCoords;
                    this.updateHoverHighlight();

                    // Show block preview if in placement mode
                    if (this.blockPlacementMode && this.renderer.showBlockPreview) {
                        this.renderer.showBlockPreview(tileCoords.x, tileCoords.y);
                    }

                    // Emit hover event
                    this.emit('tileHover', {
                        x: tileCoords.x,
                        y: tileCoords.y,
                        tile: this.board.getTile(tileCoords.x, tileCoords.y),
                    });
                }
            }
        } else {
            // No tile hovered
            if (this.hoveredTile) {
                this.hoveredTile = null;
                this.hideHoverHighlight();
                
                // Hide block preview
                if (this.renderer.hideBlockPreview) {
                    this.renderer.hideBlockPreview();
                }
                
                this.emit('tileHoverEnd', {});
            }
        }
    }

    /**
     * Handle mouse click - select tile
     * @param {MouseEvent} event - Mouse event
     */
    onMouseClick(event) {
        // Calculate normalized device coordinates
        const rect = this.renderer.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

        // Get all tile meshes as an array
        const tileMeshes = Array.from(this.renderer.tileMeshes.values());

        // Find intersected objects
        const intersects = this.raycaster.intersectObjects(tileMeshes, false);

        if (intersects.length > 0) {
            // Get the closest intersected tile
            const intersectedMesh = intersects[0].object;

            // Find which tile this mesh belongs to
            const tileCoords = this.findTileFromMesh(intersectedMesh);

            if (tileCoords) {
                this.selectedTile = tileCoords;

                // Emit click event
                this.emit('tileClick', {
                    x: tileCoords.x,
                    y: tileCoords.y,
                    tile: this.board.getTile(tileCoords.x, tileCoords.y),
                });

            }
        }
    }

    /**
     * Find tile coordinates from mesh
     * @param {THREE.Mesh} mesh - Tile mesh
     * @returns {{x: number, y: number}|null} Tile coordinates
     */
    findTileFromMesh(mesh) {
        // Search through tileMeshes map to find matching mesh
        for (let [key, tileMesh] of this.renderer.tileMeshes) {
            if (tileMesh === mesh) {
                const coords = key.split(',');
                return {
                    x: parseInt(coords[0]),
                    y: parseInt(coords[1]),
                };
            }
        }
        return null;
    }

    /**
     * Update hover highlight position
     */
    updateHoverHighlight() {
        if (this.hoveredTile && this.hoverHighlight) {
            this.hoverHighlight.position.set(
                this.hoveredTile.x,
                0.2,
                this.hoveredTile.y
            );
            this.hoverHighlight.visible = true;

            // Update glow
            if (this.hoverGlow) {
                this.hoverGlow.position.set(
                    this.hoveredTile.x,
                    0.25,
                    this.hoveredTile.y
                );
                this.hoverGlow.visible = true;
            }
        }
    }

    /**
     * Hide hover highlight
     */
    hideHoverHighlight() {
        if (this.hoverHighlight) {
            this.hoverHighlight.visible = false;
        }
        if (this.hoverGlow) {
            this.hoverGlow.visible = false;
        }
    }

    /**
     * Handle key down
     * @param {KeyboardEvent} event - Keyboard event
     */
    onKeyDown(event) {
        this.keys[event.key] = true;

        const key = (event.key || '').toLowerCase();
        const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
        if (movementKeys.includes(key)) {
            event.preventDefault();
        }

        // Handle debug mode keys
        if (this.debugMode) {
            this.debugMode.handleKeyPress(event.key);
        }

        // Emit key events
        this.emit('keyDown', { key: event.key, repeat: event.repeat === true });

        // Spacebar
        if (event.key === ' ') {
            this.emit('spacebar', {});
        }
    }

    /**
     * Handle key up
     * @param {KeyboardEvent} event - Keyboard event
     */
    onKeyUp(event) {
        this.keys[event.key] = false;
        this.emit('keyUp', { key: event.key });
    }

    /**
     * Check if key is pressed
     * @param {string} key - Key to check
     * @returns {boolean} True if key is pressed
     */
    isKeyPressed(key) {
        return this.keys[key] || false;
    }

    /**
     * Get currently hovered tile
     * @returns {{x: number, y: number}|null} Hovered tile coordinates
     */
    getHoveredTile() {
        return this.hoveredTile;
    }

    /**
     * Get currently selected tile
     * @returns {{x: number, y: number}|null} Selected tile coordinates
     */
    getSelectedTile() {
        return this.selectedTile;
    }

    /**
     * Clear selected tile
     */
    clearSelection() {
        this.selectedTile = null;
        this.emit('selectionCleared', {});
    }

    /**
     * Dispose of resources
     */
    dispose() {
        // Remove event listeners
        const canvas = this.renderer.canvas;
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('click', this.onMouseClick);
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);

        // Remove hover highlight from scene
        if (this.hoverHighlight) {
            this.renderer.scene.remove(this.hoverHighlight);
        }
        if (this.hoverGlow) {
            this.renderer.scene.remove(this.hoverGlow);
        }

    }
}

// Expose to browser global scope
if (typeof window !== 'undefined') {
    window.InputManager = InputManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputManager;
}
