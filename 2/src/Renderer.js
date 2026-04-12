/**
 * Renderer.js - Three.js scene management and rendering
 * 
 * Handles all 3D rendering including:
 * - Scene setup with isometric camera view
 * - Lighting (directional + ambient)
 * - Tile and agent mesh management
 * - Responsive canvas sizing
 */

class Renderer {
    /**
     * Get renderer constants with fallback values
     * @returns {Object} Renderer constants
     */
    static getConstants() {
        return (typeof window !== 'undefined' && window.GAME_CONSTANTS)
            ? window.GAME_CONSTANTS
            : { TURN_LIMIT: 18 };
    }

    /**
     * Constructor
     * @param {HTMLCanvasElement} canvasElement - Canvas to render to
     * @param {Board} board - Board instance for dimensions
     * @param {Array} agents - Optional array of agents to render
     */
    constructor(canvasElement, board, agents = null) {
        if (!canvasElement) {
            throw new Error('Canvas element required for Renderer');
        }
        if (!board) {
            throw new Error('Board instance required for Renderer');
        }

        this.canvas = canvasElement;
        this.board = board;

        // Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;  // OrbitControls

        // Mesh storage
        this.tileMeshes = new Map();      // Key: "x,y", Value: THREE.Mesh
        this.agentMeshes = new Map();     // Key: agent.id, Value: THREE.Mesh
        this.agentAuraMeshes = new Map(); // Key: agent.id, Value: THREE.Mesh (special agent aura)
        this.agentInjuryMeshes = new Map(); // Key: agent.id, Value: THREE.Sprite (injury icon)
        this.agentCriminalMeshes = new Map(); // Key: agent.id, Value: THREE.Sprite (criminal icon)
        this.agentPhotoCameraMeshes = new Map(); // Key: agent.id, Value: THREE.Sprite (camera icon)
        this.agentRoleRingMeshes = new Map(); // Key: agent.id, Value: THREE.Mesh (player/npc role ring)
        this.agentRoleLabelMeshes = new Map(); // Key: agent.id, Value: THREE.Sprite (YOU/NPC label)
        this.trafficOverlays = new Map(); // Key: "x,y", Value: THREE.Mesh (congestion/blocking)
        this.agentPathMeshes = new Map(); // Key: agent.id, Value: THREE.LineSegments (multi-segment path)
        this.agentAnimations = new Map(); // Key: agent.id, Value: {from, to, progress, duration, startTime}
        this.particles = new Map();       // Key: "x,y", Value: particle mesh
        this.objectiveHighlightMeshes = {
            home: null,
            task: null,
            office: null,
            injury: null,
            criminal: null,
            cafe: null,
        };
        this.multiObjectiveHighlightMeshes = {
            hospitals: new Map(),
            jails: new Map(),
        };
        
        // Camera animation
        this.cameraAnimation = null;      // {from, to, progress, duration, startTime}
        this.baseCameraDistance = 40;
        
        const constants = Renderer.getConstants();

        // Commute-time lighting cycle (7:00 AM to 9:00 AM)
        this.currentTurn = 0;
        this.maxTurns = constants.TURN_LIMIT;
        
        // Block placement preview
        this.blockPreview = null;

        // Lighting
        this.directionalLight = null;
        this.ambientLight = null;

        // Camera settings for isometric view
        this.cameraDistance = 40;         // Distance from board center
        this.cameraHeight = 30;            // Height above board
        this.boardCenter = {
            x: board.width / 2,
            y: board.height / 2,
        };

        // Compass UI hooks
        this.compassDialElement = (typeof document !== 'undefined')
            ? document.getElementById('compassDial')
            : null;
        this.compassReadingElement = (typeof document !== 'undefined')
            ? document.getElementById('compassReading')
            : null;

        // Initialize renderer
        this.init();

        // Create board visualization
        this.createBoard(board);

        // Create agent meshes if provided
        if (agents && agents.length > 0) {
            this.createAgents(agents);
        }
    }

    /**
     * Initialize scene, camera, renderer, and lights
     * Sets up isometric view and renders initial frame
     */
    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xdcecff);
        this.scene.fog = new THREE.Fog(0xdcecff, 80, 190);

        // Create camera with isometric view
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        const aspect = width / height;

        this.camera = new THREE.PerspectiveCamera(
            75,           // field of view
            aspect,       // aspect ratio
            0.1,          // near clipping
            1000          // far clipping
        );

        // Position camera for 45° isometric view
        // Position at 45° angle around the board center, looking down
        const angle = Math.PI / 4;  // 45 degrees
        this.camera.position.set(
            this.boardCenter.x + this.cameraDistance * Math.cos(angle),
            this.cameraHeight,
            this.boardCenter.y + this.cameraDistance * Math.sin(angle)
        );
        this.camera.lookAt(this.boardCenter.x, 0, this.boardCenter.y);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
        });

        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;

        // Add lights
        this.setupLights();

        // Add ground plane
        this.addGroundPlane();

        // Render initial frame
        this.render();

        // Initialize OrbitControls after scene is set up
        this.initOrbitControls();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

    }

    /**
     * Initialize OrbitControls for camera interaction
     */
    initOrbitControls() {
        // Load OrbitControls dynamically if not already loaded
        if (typeof THREE.OrbitControls === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
            script.onload = () => {
                this.setupControls();
            };
            script.onerror = () => {
                console.warn('OrbitControls failed to load - camera will be static');
            };
            document.head.appendChild(script);
        } else {
            this.setupControls();
        }
    }

    /**
     * Set up OrbitControls once loaded
     */
    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.canvas);
        
        // Configure controls
        this.controls.target.set(this.boardCenter.x, 0, this.boardCenter.y);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 80;
        this.controls.maxPolarAngle = Math.PI / 2.2;  // Don't let camera go below ground
        
    }

    /**
     * Set up scene lighting
     * - Directional light simulating sun from top-right
     * - Ambient light for subtle fill
     */
    setupLights() {
        // Directional light (sun)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        this.directionalLight.position.set(20, 40, 20);
        this.directionalLight.target.position.set(this.boardCenter.x, 0, this.boardCenter.y);
        
        // Enable shadows
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.left = -50;
        this.directionalLight.shadow.camera.right = 50;
        this.directionalLight.shadow.camera.top = 50;
        this.directionalLight.shadow.camera.bottom = -50;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 200;

        this.scene.add(this.directionalLight);
        this.scene.add(this.directionalLight.target);

        // Ambient light (subtle fill light)
        this.ambientLight = new THREE.AmbientLight(0xa8c4e2, 0.62);
        this.scene.add(this.ambientLight);

    }

    /**
     * Add ground plane to scene
     */
    addGroundPlane() {
        const groundGeometry = new THREE.PlaneGeometry(
            this.board.width + 2,
            this.board.height + 2
        );

        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x8ea2bf,
            metalness: 0.1,
            roughness: 0.8,
        });

        const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        groundMesh.rotation.x = -Math.PI / 2;  // Rotate to lie flat
        groundMesh.position.set(this.boardCenter.x, -0.5, this.boardCenter.y);
        groundMesh.receiveShadow = true;

        this.scene.add(groundMesh);

    }

    /**
     * Create board visualization from board data
     * Generates meshes for all tile types and special locations
     * @param {Board} board - Board instance
     */
    createBoard(board) {

        const tileSize = 1.0;

        // Iterate through all tiles
        for (let y = 0; y < board.height; y++) {
            for (let x = 0; x < board.width; x++) {
                const tile = board.getTile(x, y);
                if (!tile) continue;

                const key = `${x},${y}`;
                let mesh = null;

                // Create mesh based on tile type
                if (tile.type === 'BUILDING') {
                    // Procedural buildings with explicit categories
                    mesh = this.createBuildingMesh(x, y, tileSize);

                } else if (tile.type === 'HOME') {
                    mesh = this.createBuildingMesh(x, y, tileSize, 'house');

                } else if (tile.type === 'OFFICE') {
                    mesh = this.createBuildingMesh(x, y, tileSize, 'office');

                } else if (tile.type === 'INTERSECTION') {
                    // Intersection: lighter gray plane
                    const geometry = new THREE.PlaneGeometry(
                        tileSize * 0.95,
                        tileSize * 0.95
                    );

                    const color = new THREE.Color().setHex(0x555555); // Lighter gray
                    const material = new THREE.MeshStandardMaterial({
                        color: color,
                        metalness: 0.3,
                        roughness: 0.7,
                    });

                    mesh = new THREE.Mesh(geometry, material);
                    mesh.rotation.x = -Math.PI / 2; // Lay flat
                    mesh.position.set(x, 0.01, y); // Slightly above ground
                    mesh.receiveShadow = true;

                } else if (tile.type === 'ROAD') {
                    // Road: dark gray plane
                    const geometry = new THREE.PlaneGeometry(
                        tileSize * 0.95,
                        tileSize * 0.95
                    );

                    const color = new THREE.Color().setHex(0x444444); // Dark gray
                    const material = new THREE.MeshStandardMaterial({
                        color: color,
                        metalness: 0.4,
                        roughness: 0.6,
                    });

                    mesh = new THREE.Mesh(geometry, material);
                    mesh.rotation.x = -Math.PI / 2; // Lay flat
                    mesh.position.set(x, 0.01, y); // Slightly above ground
                    mesh.receiveShadow = true;

                } else if (tile.type === 'HOSPITAL') {
                    mesh = this.createHospitalMesh(x, y, tileSize);

                } else if (tile.type === 'CAFE') {
                    mesh = this.createCafeMesh(x, y, tileSize);

                } else if (tile.type === 'JAIL') {
                    mesh = this.createJailMesh(x, y, tileSize);

                } else if (tile.type === 'LANDMARK') {
                    mesh = this.createLandmarkMesh(x, y, tileSize, tile.landmarkType);

                } else {
                    // Default: dark plane for unknown types
                    const geometry = new THREE.PlaneGeometry(
                        tileSize * 0.95,
                        tileSize * 0.95
                    );

                    const material = new THREE.MeshStandardMaterial({
                        color: 0x222222,
                        metalness: 0.2,
                        roughness: 0.9,
                    });

                    mesh = new THREE.Mesh(geometry, material);
                    mesh.rotation.x = -Math.PI / 2; // Lay flat
                    mesh.position.set(x, 0.01, y);
                    mesh.receiveShadow = true;
                }

                // Add tile mesh to scene
                if (mesh) {
                    this.scene.add(mesh);
                    this.tileMeshes.set(key, mesh);
                }

                // Add special location markers on top of tiles
                if (tile.specialLocationType) {
                    const markerMesh = this.createSpecialLocationMarker(
                        tile.specialLocationType,
                        x,
                        y
                    );
                    if (markerMesh) {
                        this.scene.add(markerMesh);
                    }
                }
            }
        }

    }

    /**
     * Noise helper for procedural variation (0..1)
     */
    noise2D(x, y, seed = 0) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
        return n - Math.floor(n);
    }

    /**
     * Determine building type by position
     */
    getBuildingType(x, y) {
        const n = this.noise2D(x, y, 13.37);
        if (n < 0.45) return 'house';
        if (n < 0.8) return 'office';
        return 'factory';
    }

    /**
     * Create procedural building mesh
     */
    createBuildingMesh(x, y, tileSize, forcedCategory = null) {
        const type = forcedCategory || this.getBuildingType(x, y);
        const heightNoise = this.noise2D(x, y, 7.77);
        const variation = this.noise2D(x, y, 91.31);

        const group = new THREE.Group();
        let baseColor = 0x8b7355;
        let metalness = 0.2;
        let roughness = 0.8;

        if (type === 'house') {
            baseColor = 0xb89c8c;
            const clusterCount = 2 + Math.floor(variation * 2);
            for (let i = 0; i < clusterCount; i++) {
                const h = 0.8 + heightNoise * 1.2 + i * 0.2;
                const w = tileSize * (0.35 + this.noise2D(x + i, y, 2.2) * 0.2);
                const d = tileSize * (0.35 + this.noise2D(x, y + i, 5.1) * 0.2);
                const geometry = new THREE.BoxGeometry(w, h, d);
                const material = new THREE.MeshStandardMaterial({
                    color: baseColor,
                    metalness,
                    roughness,
                });
                const block = new THREE.Mesh(geometry, material);
                const offsetX = (i - (clusterCount - 1) / 2) * 0.2;
                const offsetZ = (clusterCount - 1 - i) * 0.1;
                block.position.set(offsetX, h / 2, offsetZ);
                block.castShadow = true;
                block.receiveShadow = true;
                group.add(block);
            }
        } else if (type === 'office') {
            baseColor = 0x6fb3ff;
            metalness = 0.9;
            roughness = 0.25;
            const h = 1.6 + heightNoise * 2.2;
            const w = tileSize * (0.6 + variation * 0.2);
            const d = tileSize * (0.6 + (1 - variation) * 0.2);
            const geometry = new THREE.BoxGeometry(w, h, d);
            const material = new THREE.MeshStandardMaterial({
                color: baseColor,
                metalness,
                roughness,
                emissive: 0x0a1c2f,
                emissiveIntensity: 0.35,
            });
            const tower = new THREE.Mesh(geometry, material);
            tower.position.set(0, h / 2, 0);
            tower.castShadow = true;
            tower.receiveShadow = true;
            group.add(tower);

            // Add rooftop accent
            const cap = new THREE.Mesh(
                new THREE.BoxGeometry(w * 0.6, h * 0.1, d * 0.6),
                new THREE.MeshStandardMaterial({ color: 0xb6d7ff, metalness: 0.7, roughness: 0.2 })
            );
            cap.position.set(0, h * 0.95, 0);
            cap.castShadow = true;
            group.add(cap);
        } else {
            baseColor = 0x6f7b8a;
            const h = 0.6 + heightNoise * 0.8;
            const w = tileSize * 0.9;
            const d = tileSize * 0.9;
            const geometry = new THREE.BoxGeometry(w, h, d);
            const material = new THREE.MeshStandardMaterial({
                color: baseColor,
                metalness: 0.3,
                roughness: 0.9,
            });
            const block = new THREE.Mesh(geometry, material);
            block.position.set(0, h / 2, 0);
            block.castShadow = true;
            block.receiveShadow = true;
            group.add(block);

            // Add industrial chimney
            if (variation > 0.4) {
                const chimney = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.08, 0.12, 0.8, 8),
                    new THREE.MeshStandardMaterial({ color: 0x4a4f57, metalness: 0.4, roughness: 0.8 })
                );
                chimney.position.set(w * 0.2, h + 0.4, d * -0.2);
                chimney.castShadow = true;
                group.add(chimney);
            }
        }

        group.position.set(x, 0, y);
        return group;
    }

    /**
     * Create unique landmark mesh
     */
    createLandmarkMesh(x, y, tileSize, landmarkType = null) {
        const group = new THREE.Group();
        
        // If no landmark type specified, use perlin noise style variation
        if (!landmarkType) {
            const style = Math.floor(this.noise2D(x, y, 99.9) * 4);

            if (style === 0) {
                // Sphere-like (The Bean)
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(tileSize * 0.45, 24, 24),
                    new THREE.MeshStandardMaterial({
                        color: 0xb0b7c2,
                        metalness: 0.9,
                        roughness: 0.15,
                    })
                );
                sphere.position.set(0, tileSize * 0.45, 0);
                sphere.castShadow = true;
                sphere.receiveShadow = true;
                group.add(sphere);
            } else if (style === 1) {
                // Pyramid / monument
                const pyramid = new THREE.Mesh(
                    new THREE.ConeGeometry(tileSize * 0.5, tileSize * 1.4, 4),
                    new THREE.MeshStandardMaterial({
                        color: 0xd4b483,
                        metalness: 0.2,
                        roughness: 0.7,
                    })
                );
                pyramid.rotation.y = Math.PI / 4;
                pyramid.position.set(0, tileSize * 0.7, 0);
                pyramid.castShadow = true;
                pyramid.receiveShadow = true;
                group.add(pyramid);
            } else if (style === 2) {
                // Tower (Empire State)
                const base = new THREE.Mesh(
                    new THREE.BoxGeometry(tileSize * 0.7, tileSize * 1.2, tileSize * 0.7),
                    new THREE.MeshStandardMaterial({ color: 0x6f87a6, metalness: 0.5, roughness: 0.5 })
                );
                base.position.set(0, tileSize * 0.6, 0);
                base.castShadow = true;
                base.receiveShadow = true;
                group.add(base);

                const spire = new THREE.Mesh(
                    new THREE.CylinderGeometry(tileSize * 0.08, tileSize * 0.14, tileSize * 1.0, 8),
                    new THREE.MeshStandardMaterial({ color: 0xc3d6f5, metalness: 0.8, roughness: 0.3 })
                );
                spire.position.set(0, tileSize * 1.4, 0);
                spire.castShadow = true;
                group.add(spire);
            } else {
                // Arch (Eiffel-esque)
                const material = new THREE.MeshStandardMaterial({ color: 0x9a7f5a, metalness: 0.3, roughness: 0.6 });
                const legGeometry = new THREE.BoxGeometry(tileSize * 0.12, tileSize * 1.2, tileSize * 0.12);
                const leg1 = new THREE.Mesh(legGeometry, material);
                const leg2 = new THREE.Mesh(legGeometry, material);
                leg1.position.set(tileSize * -0.2, tileSize * 0.6, tileSize * -0.2);
                leg2.position.set(tileSize * 0.2, tileSize * 0.6, tileSize * 0.2);
                group.add(leg1, leg2);

                const top = new THREE.Mesh(
                    new THREE.ConeGeometry(tileSize * 0.25, tileSize * 0.8, 6),
                    material
                );
                top.position.set(0, tileSize * 1.4, 0);
                group.add(top);
            }
        } else {
            // Use specific landmark type
            if (landmarkType === 'STATUE') {
                // Gray cylinder (statue base) with sphere on top (person)
                const base = new THREE.Mesh(
                    new THREE.CylinderGeometry(tileSize * 0.3, tileSize * 0.35, tileSize * 0.4, 8),
                    new THREE.MeshStandardMaterial({
                        color: 0x888888,
                        metalness: 0.5,
                        roughness: 0.6,
                    })
                );
                base.position.set(0, tileSize * 0.2, 0);
                base.castShadow = true;
                base.receiveShadow = true;
                group.add(base);

                const head = new THREE.Mesh(
                    new THREE.SphereGeometry(tileSize * 0.25, 16, 16),
                    new THREE.MeshStandardMaterial({
                        color: 0xa0a0a0,
                        metalness: 0.4,
                        roughness: 0.5,
                    })
                );
                head.position.set(0, tileSize * 0.75, 0);
                head.castShadow = true;
                group.add(head);
            } else if (landmarkType === 'FOUNTAIN') {
                // Blue circular structure with water effect
                const base = new THREE.Mesh(
                    new THREE.CylinderGeometry(tileSize * 0.45, tileSize * 0.5, tileSize * 0.3, 32),
                    new THREE.MeshStandardMaterial({
                        color: 0x4a90e2,
                        metalness: 0.6,
                        roughness: 0.4,
                    })
                );
                base.position.set(0, tileSize * 0.15, 0);
                base.castShadow = true;
                group.add(base);

                const center = new THREE.Mesh(
                    new THREE.CylinderGeometry(tileSize * 0.15, tileSize * 0.12, tileSize * 0.5, 16),
                    new THREE.MeshStandardMaterial({
                        color: 0x2196f3,
                        metalness: 0.7,
                        roughness: 0.3,
                    })
                );
                center.position.set(0, tileSize * 0.5, 0);
                center.castShadow = true;
                group.add(center);
            } else if (landmarkType === 'PARK') {
                // Green cones (trees)
                const colors = [0x228B22, 0x32CD32, 0x00AA00];
                for (let i = 0; i < 3; i++) {
                    const tree = new THREE.Mesh(
                        new THREE.ConeGeometry(tileSize * 0.25, tileSize * 0.7, 8),
                        new THREE.MeshStandardMaterial({
                            color: colors[i],
                            metalness: 0.0,
                            roughness: 0.8,
                        })
                    );
                    const angle = (i / 3) * Math.PI * 2;
                    tree.position.set(
                        Math.cos(angle) * tileSize * 0.2,
                        tileSize * 0.35,
                        Math.sin(angle) * tileSize * 0.2
                    );
                    tree.castShadow = true;
                    group.add(tree);
                }
            } else if (landmarkType === 'MONUMENT') {
                // Tall tan rectangular prism (obelisk)
                const monument = new THREE.Mesh(
                    new THREE.BoxGeometry(tileSize * 0.25, tileSize * 1.5, tileSize * 0.25),
                    new THREE.MeshStandardMaterial({
                        color: 0xd4b896,
                        metalness: 0.2,
                        roughness: 0.7,
                    })
                );
                monument.position.set(0, tileSize * 0.75, 0);
                monument.castShadow = true;
                monument.receiveShadow = true;
                group.add(monument);

                // Top cap
                const cap = new THREE.Mesh(
                    new THREE.ConeGeometry(tileSize * 0.15, tileSize * 0.3, 4),
                    new THREE.MeshStandardMaterial({
                        color: 0xc4a87a,
                        metalness: 0.3,
                        roughness: 0.6,
                    })
                );
                cap.position.set(0, tileSize * 1.5, 0);
                cap.castShadow = true;
                group.add(cap);
            } else if (landmarkType === 'TOWER') {
                // Very tall thin cylinder (spire)
                const spire = new THREE.Mesh(
                    new THREE.CylinderGeometry(tileSize * 0.1, tileSize * 0.15, tileSize * 1.8, 12),
                    new THREE.MeshStandardMaterial({
                        color: 0xc3a87f,
                        metalness: 0.4,
                        roughness: 0.5,
                    })
                );
                spire.position.set(0, tileSize * 0.9, 0);
                spire.castShadow = true;
                spire.receiveShadow = true;
                group.add(spire);

                // Top cap
                const cap = new THREE.Mesh(
                    new THREE.ConeGeometry(tileSize * 0.12, tileSize * 0.4, 8),
                    new THREE.MeshStandardMaterial({
                        color: 0xffc107,
                        metalness: 0.8,
                        roughness: 0.2,
                    })
                );
                cap.position.set(0, tileSize * 1.8, 0);
                cap.castShadow = true;
                group.add(cap);
            } else if (landmarkType === 'MUSEUM') {
                // Large rectangular building with columns
                const building = new THREE.Mesh(
                    new THREE.BoxGeometry(tileSize * 0.7, tileSize * 0.8, tileSize * 0.5),
                    new THREE.MeshStandardMaterial({
                        color: 0xc9a876,
                        metalness: 0.1,
                        roughness: 0.8,
                    })
                );
                building.position.set(0, tileSize * 0.4, 0);
                building.castShadow = true;
                building.receiveShadow = true;
                group.add(building);

                // Front columns
                const columnGeom = new THREE.CylinderGeometry(tileSize * 0.06, tileSize * 0.06, tileSize * 0.8, 8);
                const columnMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, metalness: 0.2, roughness: 0.6 });
                for (let i = -1; i <= 1; i++) {
                    const column = new THREE.Mesh(columnGeom, columnMat);
                    column.position.set(i * tileSize * 0.15, tileSize * 0.4, tileSize * 0.3);
                    column.castShadow = true;
                    group.add(column);
                }

                // Roof
                const roof = new THREE.Mesh(
                    new THREE.BoxGeometry(tileSize * 0.75, tileSize * 0.15, tileSize * 0.55),
                    new THREE.MeshStandardMaterial({ color: 0x8b7355, metalness: 0, roughness: 0.9 })
                );
                roof.position.set(0, tileSize * 0.87, 0);
                roof.castShadow = true;
                group.add(roof);
            } else if (landmarkType === 'BRIDGE') {
                // Arched stone bridge structure
                const archGeom = new THREE.TorusGeometry(tileSize * 0.35, tileSize * 0.1, 8, 32, 0, Math.PI);
                const archMat = new THREE.MeshStandardMaterial({
                    color: 0x8b7355,
                    metalness: 0.1,
                    roughness: 0.8,
                });
                const arch = new THREE.Mesh(archGeom, archMat);
                arch.rotation.x = Math.PI / 2;
                arch.position.set(0, tileSize * 0.3, 0);
                arch.castShadow = true;
                group.add(arch);

                // Bridge deck
                const deck = new THREE.Mesh(
                    new THREE.BoxGeometry(tileSize * 0.8, tileSize * 0.15, tileSize * 0.4),
                    new THREE.MeshStandardMaterial({
                        color: 0x696969,
                        metalness: 0.3,
                        roughness: 0.7,
                    })
                );
                deck.position.set(0, tileSize * 0.5, 0);
                deck.castShadow = true;
                group.add(deck);
            } else if (landmarkType === 'SCULPTURE') {
                // Abstract colorful sculpture
                const colors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3];
                const shapes = [
                    { geom: new THREE.ConeGeometry(tileSize * 0.2, tileSize * 0.6, 6), pos: [0, tileSize * 0.3, 0] },
                    { geom: new THREE.SphereGeometry(tileSize * 0.15, 16, 16), pos: [tileSize * 0.15, tileSize * 0.7, 0] },
                    { geom: new THREE.BoxGeometry(tileSize * 0.2, tileSize * 0.3, tileSize * 0.2), pos: [tileSize * -0.15, tileSize * 0.5, 0] },
                    { geom: new THREE.CylinderGeometry(tileSize * 0.08, tileSize * 0.12, tileSize * 0.8, 8), pos: [0, tileSize * 0.9, tileSize * 0.1] },
                ];

                shapes.forEach((shape, idx) => {
                    const mesh = new THREE.Mesh(
                        shape.geom,
                        new THREE.MeshStandardMaterial({
                            color: colors[idx % colors.length],
                            metalness: 0.4,
                            roughness: 0.5,
                        })
                    );
                    mesh.position.set(shape.pos[0], shape.pos[1], shape.pos[2]);
                    mesh.castShadow = true;
                    group.add(mesh);
                });
            } else if (landmarkType === 'HISTORIC_BUILDING') {
                // Ornate aged building with archways
                const building = new THREE.Mesh(
                    new THREE.BoxGeometry(tileSize * 0.6, tileSize * 1.0, tileSize * 0.5),
                    new THREE.MeshStandardMaterial({
                        color: 0xb8860b,
                        metalness: 0.05,
                        roughness: 0.9,
                    })
                );
                building.position.set(0, tileSize * 0.5, 0);
                building.castShadow = true;
                building.receiveShadow = true;
                group.add(building);

                // Archways
                const archGeom = new THREE.TorusGeometry(tileSize * 0.1, tileSize * 0.04, 4, 16, 0, Math.PI);
                const archMat = new THREE.MeshStandardMaterial({ color: 0xa0826d, metalness: 0.1, roughness: 0.8 });
                for (let i = -1; i <= 1; i++) {
                    const arch = new THREE.Mesh(archGeom, archMat);
                    arch.rotation.x = Math.PI / 2;
                    arch.position.set(i * tileSize * 0.2, tileSize * 0.5, tileSize * 0.3);
                    arch.castShadow = true;
                    group.add(arch);
                }

                // Ornamental roof
                const roof = new THREE.Mesh(
                    new THREE.ConeGeometry(tileSize * 0.32, tileSize * 0.25, 4),
                    new THREE.MeshStandardMaterial({ color: 0x8b4513, metalness: 0, roughness: 0.8 })
                );
                roof.position.set(0, tileSize * 1.1, 0);
                roof.castShadow = true;
                group.add(roof);
            } else if (landmarkType === 'PLAZA') {
                // Open plaza with decorative pavement pattern
                const plaza = new THREE.Mesh(
                    new THREE.PlaneGeometry(tileSize * 0.8, tileSize * 0.8),
                    new THREE.MeshStandardMaterial({
                        color: 0xd4a574,
                        metalness: 0.0,
                        roughness: 0.9,
                    })
                );
                plaza.rotation.x = -Math.PI / 2;
                plaza.position.set(0, 0.05, 0);
                plaza.receiveShadow = true;
                group.add(plaza);

                // Decorative center feature
                const centerGeom = new THREE.CylinderGeometry(tileSize * 0.15, tileSize * 0.15, tileSize * 0.1, 16);
                const centerMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.3, roughness: 0.6 });
                const center = new THREE.Mesh(centerGeom, centerMat);
                center.position.set(0, 0.15, 0);
                center.castShadow = true;
                group.add(center);

                // Pattern rings
                for (let i = 1; i <= 2; i++) {
                    const ring = new THREE.Mesh(
                        new THREE.TorusGeometry(tileSize * 0.25 * i, tileSize * 0.02, 8, 32),
                        new THREE.MeshStandardMaterial({ color: 0x8b7355, metalness: 0.1, roughness: 0.8 })
                    );
                    ring.rotation.x = -Math.PI / 2;
                    ring.position.set(0, 0.08, 0);
                    group.add(ring);
                }
            } else if (landmarkType === 'TEMPLE') {
                // Distinctive roof with cultural architecture
                const base = new THREE.Mesh(
                    new THREE.BoxGeometry(tileSize * 0.5, tileSize * 0.6, tileSize * 0.5),
                    new THREE.MeshStandardMaterial({
                        color: 0xcd853f,
                        metalness: 0.1,
                        roughness: 0.7,
                    })
                );
                base.position.set(0, tileSize * 0.3, 0);
                base.castShadow = true;
                group.add(base);

                // Distinctive curved roof (pagoda-style)
                const roofOuter = new THREE.Mesh(
                    new THREE.ConeGeometry(tileSize * 0.35, tileSize * 0.5, 8),
                    new THREE.MeshStandardMaterial({
                        color: 0xff6347,
                        metalness: 0.2,
                        roughness: 0.6,
                    })
                );
                roofOuter.position.set(0, tileSize * 0.85, 0);
                roofOuter.castShadow = true;
                group.add(roofOuter);

                // Inner roof layer
                const roofInner = new THREE.Mesh(
                    new THREE.ConeGeometry(tileSize * 0.25, tileSize * 0.35, 8),
                    new THREE.MeshStandardMaterial({
                        color: 0xffa500,
                        metalness: 0.2,
                        roughness: 0.6,
                    })
                );
                roofInner.position.set(0, tileSize * 1.0, 0);
                roofInner.castShadow = true;
                group.add(roofInner);

                // Spire
                const spire = new THREE.Mesh(
                    new THREE.CylinderGeometry(tileSize * 0.06, tileSize * 0.04, tileSize * 0.4, 8),
                    new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 })
                );
                spire.position.set(0, tileSize * 1.3, 0);
                spire.castShadow = true;
                group.add(spire);
            } else if (landmarkType === 'CLOCK_TOWER') {
                // Tall with prominent clock face
                const tower = new THREE.Mesh(
                    new THREE.CylinderGeometry(tileSize * 0.2, tileSize * 0.2, tileSize * 1.2, 16),
                    new THREE.MeshStandardMaterial({
                        color: 0x8b4513,
                        metalness: 0.1,
                        roughness: 0.8,
                    })
                );
                tower.position.set(0, tileSize * 0.6, 0);
                tower.castShadow = true;
                group.add(tower);

                // Clock face
                const clockFace = new THREE.Mesh(
                    new THREE.CylinderGeometry(tileSize * 0.15, tileSize * 0.15, tileSize * 0.05, 32),
                    new THREE.MeshStandardMaterial({
                        color: 0xf5f5dc,
                        metalness: 0.2,
                        roughness: 0.6,
                    })
                );
                clockFace.position.set(0, tileSize * 1.3, tileSize * 0.21);
                clockFace.castShadow = true;
                group.add(clockFace);

                // Clock hands
                const handMat = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.8, roughness: 0.2 });
                const hourHand = new THREE.Mesh(
                    new THREE.BoxGeometry(tileSize * 0.03, tileSize * 0.08, tileSize * 0.02),
                    handMat
                );
                hourHand.position.set(0, tileSize * 1.33, tileSize * 0.24);
                hourHand.rotation.z = Math.PI / 4;
                group.add(hourHand);

                const minuteHand = new THREE.Mesh(
                    new THREE.BoxGeometry(tileSize * 0.02, tileSize * 0.1, tileSize * 0.02),
                    handMat
                );
                minuteHand.position.set(0, tileSize * 1.33, tileSize * 0.24);
                minuteHand.rotation.z = -Math.PI / 6;
                group.add(minuteHand);

                // Spire top
                const spire = new THREE.Mesh(
                    new THREE.ConeGeometry(tileSize * 0.12, tileSize * 0.3, 8),
                    new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.7, roughness: 0.3 })
                );
                spire.position.set(0, tileSize * 1.65, 0);
                spire.castShadow = true;
                group.add(spire);
            } else if (landmarkType === 'GARDEN') {
                // Organic shapes with lots of greenery
                const groundPlane = new THREE.Mesh(
                    new THREE.PlaneGeometry(tileSize * 0.7, tileSize * 0.7),
                    new THREE.MeshStandardMaterial({
                        color: 0x228b22,
                        metalness: 0.0,
                        roughness: 0.9,
                    })
                );
                groundPlane.rotation.x = -Math.PI / 2;
                groundPlane.position.set(0, 0.02, 0);
                groundPlane.receiveShadow = true;
                group.add(groundPlane);

                // Various plants and trees scattered organically
                const plantColors = [0x228b22, 0x32cd32, 0x00aa00, 0x2d5016];
                const plantPositions = [
                    [tileSize * 0.2, 0.15, tileSize * 0.1],
                    [tileSize * -0.15, 0.2, tileSize * 0.2],
                    [tileSize * 0.1, 0.12, tileSize * -0.2],
                    [tileSize * -0.2, 0.18, tileSize * -0.15],
                ];

                plantPositions.forEach((pos, idx) => {
                    const plant = new THREE.Mesh(
                        new THREE.ConeGeometry(tileSize * 0.15, tileSize * 0.5, 8),
                        new THREE.MeshStandardMaterial({
                            color: plantColors[idx % plantColors.length],
                            metalness: 0.0,
                            roughness: 0.9,
                        })
                    );
                    plant.position.set(pos[0], pos[1], pos[2]);
                    plant.castShadow = true;
                    group.add(plant);
                });

                // Decorative path/walkway
                const path = new THREE.Mesh(
                    new THREE.BoxGeometry(tileSize * 0.15, tileSize * 0.02, tileSize * 0.4),
                    new THREE.MeshStandardMaterial({
                        color: 0xd3d3d3,
                        metalness: 0.1,
                        roughness: 0.8,
                    })
                );
                path.position.set(0, 0.05, 0);
                path.receiveShadow = true;
                group.add(path);
            }
        }

        group.position.set(x, 0, y);
        return group;
    }

    /**
     * Create a special location marker (cylinder) on a tile
     * Markers for HOME, OFFICE, CAFE, HOSPITAL, LANDMARK
     * @param {string} type - Special location type
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @returns {THREE.Mesh} Marker mesh
     */
    createSpecialLocationMarker(type, x, y) {
        if (type === 'LANDMARK' || type === 'HOSPITAL' || type === 'JAIL' || type === 'CAFE') {
            return null;
        }

        const markerHeight = 0.3;
        const markerRadius = 0.2;

        const geometry = new THREE.CylinderGeometry(markerRadius, markerRadius, markerHeight, 8);

        // Determine color based on location type
        let color = 0x4da6ff; // Default blue

        if (type === 'HOME') {
            color = 0x00cc00; // Green
        } else if (type === 'OFFICE') {
            color = 0xff0000; // Red
        } else if (type === 'CAFE') {
            color = 0xffcc00; // Yellow
        } else if (type === 'HOSPITAL') {
            color = 0xff6666; // Light red/pink
        } else if (type === 'LANDMARK') {
            color = 0x00ffff; // Cyan
        }

        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.5,
            roughness: 0.3,
            emissive: color,
            emissiveIntensity: 0.2,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, markerHeight / 2 + 0.05, y); // Sit on top of tile
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    /**
     * Create hospital mesh with white building and red cross
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @param {number} tileSize - Tile size
     * @returns {THREE.Group} Hospital mesh group
     */
    createHospitalMesh(x, y, tileSize) {
        const group = new THREE.Group();

        const baseHeight = tileSize * 0.9;
        const baseGeometry = new THREE.BoxGeometry(tileSize * 0.85, baseHeight, tileSize * 0.85);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.6,
            emissive: 0xeeeeee,
            emissiveIntensity: 0.15,
        });

        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(0, baseHeight / 2, 0);
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const crossMaterial = new THREE.MeshStandardMaterial({
            color: 0xff2d2d,
            metalness: 0.2,
            roughness: 0.4,
            emissive: 0xff2d2d,
            emissiveIntensity: 0.6,
        });

        const barThickness = tileSize * 0.08;
        const verticalBar = new THREE.Mesh(
            new THREE.BoxGeometry(barThickness, tileSize * 0.45, barThickness),
            crossMaterial
        );
        verticalBar.position.set(0, baseHeight + tileSize * 0.2, 0);

        const horizontalBar = new THREE.Mesh(
            new THREE.BoxGeometry(tileSize * 0.45, barThickness, barThickness),
            crossMaterial
        );
        horizontalBar.position.set(0, baseHeight + tileSize * 0.2, 0);

        group.add(verticalBar, horizontalBar);
        group.position.set(x, 0, y);

        return group;
    }

    /**
     * Create jail mesh with dark building and bars
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @param {number} tileSize - Tile size
     * @returns {THREE.Group} Jail mesh group
     */
    createJailMesh(x, y, tileSize) {
        const group = new THREE.Group();

        const baseHeight = tileSize * 1.0;
        const baseGeometry = new THREE.BoxGeometry(tileSize * 0.9, baseHeight, tileSize * 0.9);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x9c27b0,
            metalness: 0.2,
            roughness: 0.6,
            emissive: 0x7b1fa2,
            emissiveIntensity: 0.3,
        });

        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(0, baseHeight / 2, 0);
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const barMaterial = new THREE.MeshStandardMaterial({
            color: 0xba68c8,
            metalness: 0.6,
            roughness: 0.3,
            emissive: 0x9c27b0,
            emissiveIntensity: 0.3,
        });

        const barCount = 4;
        for (let i = 0; i < barCount; i++) {
            const offset = (i - (barCount - 1) / 2) * (tileSize * 0.18);
            const bar = new THREE.Mesh(
                new THREE.BoxGeometry(tileSize * 0.04, baseHeight * 0.8, tileSize * 0.02),
                barMaterial
            );
            bar.position.set(offset, baseHeight * 0.55, tileSize * 0.46);
            group.add(bar);
        }

        group.position.set(x, 0, y);
        return group;
    }

    /**
     * Create cafe mesh with yellow building and window details
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @param {number} tileSize - Tile size
     * @returns {THREE.Group} Cafe mesh group
     */
    createCafeMesh(x, y, tileSize) {
        const group = new THREE.Group();

        const baseHeight = tileSize * 0.8;
        const baseGeometry = new THREE.BoxGeometry(tileSize * 0.85, baseHeight, tileSize * 0.85);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd43b,
            metalness: 0.1,
            roughness: 0.5,
            emissive: 0xffc107,
            emissiveIntensity: 0.2,
        });

        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(0, baseHeight / 2, 0);
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Add window details
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x87ceeb,
            metalness: 0.7,
            roughness: 0.2,
            emissive: 0x4099ff,
            emissiveIntensity: 0.3,
        });

        const windowSize = tileSize * 0.15;
        const windowPositions = [
            { x: -0.2, z: 0.42 },
            { x: 0.2, z: 0.42 },
            { x: -0.2, z: -0.42 },
            { x: 0.2, z: -0.42 },
        ];

        for (const pos of windowPositions) {
            const window = new THREE.Mesh(
                new THREE.BoxGeometry(windowSize, windowSize, windowSize * 0.1),
                windowMaterial
            );
            window.position.set(pos.x, baseHeight * 0.6, pos.z);
            group.add(window);
        }

        // Add roof accent
        const roofMaterial = new THREE.MeshStandardMaterial({
            color: 0xff8c00,
            metalness: 0.2,
            roughness: 0.6,
            emissive: 0xff6b00,
            emissiveIntensity: 0.15,
        });

        const roofGeometry = new THREE.BoxGeometry(tileSize * 0.9, tileSize * 0.1, tileSize * 0.9);
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(0, baseHeight + tileSize * 0.05, 0);
        group.add(roof);

        group.position.set(x, 0, y);
        return group;
    }

    /**
     * Add a tile mesh to the scene
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @param {Tile} tile - Tile object with type and color
     * @returns {THREE.Mesh} Created mesh
     */
    addTileMesh(x, y, tile) {
        const key = `${x},${y}`;

        // Skip if already exists
        if (this.tileMeshes.has(key)) {
            return this.tileMeshes.get(key);
        }

        // Create tile geometry (small cube)
        const geometry = new THREE.BoxGeometry(0.9, 0.2, 0.9);

        // Get color from tile
        const color = new THREE.Color(tile.color || '#4da6ff');

        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.3,
            roughness: 0.7,
            side: THREE.FrontSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 0, y);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.scene.add(mesh);
        this.tileMeshes.set(key, mesh);

        return mesh;
    }

    /**
     * Update tile mesh color
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @param {string} color - Hex color string
     */
    updateTileMeshColor(x, y, color) {
        const key = `${x},${y}`;
        const mesh = this.tileMeshes.get(key);

        if (mesh && mesh.material) {
            mesh.material.color.setStyle(color);
        }
    }

    /**
     * Create agent meshes for all agents
     * Creates small spheres at agent locations with agent colors
     * @param {Array} agents - Array of Agent objects
     */
    createAgents(agents) {
        this.clearAgentVisuals();

        const playerAgent = Array.isArray(agents) && agents.length > 0 ? agents[0] : null;
        if (!playerAgent) {
            return;
        }

        const agentsToRender = Array.isArray(agents) ? agents : [playerAgent];

        for (const agent of agentsToRender) {
            const isCommuterNpc = agent.isCommuter === true;
            const isPlayer = agent.isPlayerControlled === true;

            // Player: sphere orb, NPC commuter: smaller cube
            const geometry = isCommuterNpc
                ? new THREE.BoxGeometry(0.28, 0.28, 0.28)
                : new THREE.SphereGeometry(0.24, 16, 16);

            // Use agent color for material
            const color = new THREE.Color(agent.color || '#4da6ff');

            const material = new THREE.MeshStandardMaterial({
                color: color,
                metalness: 0.6,
                roughness: 0.2,
                emissive: color,
                emissiveIntensity: isCommuterNpc ? 0.2 : 0.38,
            });

            // Create mesh
            const mesh = new THREE.Mesh(geometry, material);

            // Position at agent location, elevated above ground (0.5 units)
            mesh.position.set(
                agent.currentLocation.x,
                isCommuterNpc ? 0.32 : 0.5,
                agent.currentLocation.y
            );

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Add to scene and store in map
            this.scene.add(mesh);
            this.agentMeshes.set(agent.id.toString(), mesh);

            const roleRingGeometry = new THREE.TorusGeometry(isPlayer ? 0.34 : 0.28, 0.04, 10, 20);
            const roleRingColor = isPlayer ? 0x4da6ff : 0xff8c42;
            const roleRingMaterial = new THREE.MeshStandardMaterial({
                color: roleRingColor,
                emissive: roleRingColor,
                emissiveIntensity: isPlayer ? 1.0 : 0.55,
                transparent: true,
                opacity: isPlayer ? 0.95 : 0.8,
            });
            const roleRing = new THREE.Mesh(roleRingGeometry, roleRingMaterial);
            roleRing.rotation.x = Math.PI / 2;
            roleRing.position.set(agent.currentLocation.x, 0.18, agent.currentLocation.y);
            roleRing.userData.isPlayer = isPlayer;
            this.scene.add(roleRing);
            this.agentRoleRingMeshes.set(agent.id.toString(), roleRing);

            const roleCanvas = document.createElement('canvas');
            roleCanvas.width = 128;
            roleCanvas.height = 64;
            const roleCtx = roleCanvas.getContext('2d');

            roleCtx.clearRect(0, 0, 128, 64);
            roleCtx.fillStyle = isPlayer ? 'rgba(77,166,255,0.95)' : 'rgba(255,140,66,0.95)';
            roleCtx.fillRect(8, 12, 112, 40);
            roleCtx.fillStyle = '#ffffff';
            roleCtx.font = 'bold 26px Segoe UI';
            roleCtx.textAlign = 'center';
            roleCtx.textBaseline = 'middle';
            roleCtx.fillText(isPlayer ? 'YOU' : 'NPC', 64, 33);

            const roleTexture = new THREE.CanvasTexture(roleCanvas);
            const roleMaterial = new THREE.SpriteMaterial({
                map: roleTexture,
                transparent: true,
                depthTest: false,
                depthWrite: false,
            });
            const roleSprite = new THREE.Sprite(roleMaterial);
            roleSprite.position.set(agent.currentLocation.x, isPlayer ? 1.25 : 1.05, agent.currentLocation.y);
            roleSprite.scale.set(isPlayer ? 0.95 : 0.82, 0.4, 1);
            this.scene.add(roleSprite);
            this.agentRoleLabelMeshes.set(agent.id.toString(), roleSprite);

            // Create special agent aura (hidden by default)
            const auraGeometry = new THREE.TorusGeometry(0.35, 0.06, 12, 24);
            const auraMaterial = new THREE.MeshStandardMaterial({
                color: 0x6f5bff,
                emissive: 0x6f5bff,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.0,
            });

            const aura = new THREE.Mesh(auraGeometry, auraMaterial);
            aura.rotation.x = Math.PI / 2;
            aura.position.set(agent.currentLocation.x, 0.28, agent.currentLocation.y);
            aura.visible = false;
            aura.userData.fadeState = null;
            aura.userData.fadeStart = 0;

            this.scene.add(aura);
            this.agentAuraMeshes.set(agent.id.toString(), aura);

            // Create injury icon sprite (hidden by default)
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');

            ctx.clearRect(0, 0, 64, 64);
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.arc(32, 32, 20, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ff2d2d';
            ctx.fillRect(28, 16, 8, 32);
            ctx.fillRect(16, 28, 32, 8);

            const injuryTexture = new THREE.CanvasTexture(canvas);
            const injuryMaterial = new THREE.SpriteMaterial({
                map: injuryTexture,
                transparent: true,
                opacity: 0.0,
            });

            const injurySprite = new THREE.Sprite(injuryMaterial);
            injurySprite.position.set(agent.currentLocation.x, 0.9, agent.currentLocation.y);
            injurySprite.scale.set(0.35, 0.35, 1);
            injurySprite.visible = false;
            injurySprite.userData.pulseStart = Date.now();

            this.scene.add(injurySprite);
            this.agentInjuryMeshes.set(agent.id.toString(), injurySprite);

            // Create criminal icon sprite (hidden by default)
            const crimeCanvas = document.createElement('canvas');
            crimeCanvas.width = 64;
            crimeCanvas.height = 64;
            const crimeCtx = crimeCanvas.getContext('2d');

            crimeCtx.clearRect(0, 0, 64, 64);
            crimeCtx.fillStyle = 'rgba(255, 165, 0, 0.9)';
            crimeCtx.beginPath();
            crimeCtx.arc(32, 32, 20, 0, Math.PI * 2);
            crimeCtx.fill();

            crimeCtx.fillStyle = '#1a1a1a';
            crimeCtx.fillRect(22, 24, 6, 20);
            crimeCtx.fillRect(36, 24, 6, 20);
            crimeCtx.fillRect(28, 32, 8, 6);

            const crimeTexture = new THREE.CanvasTexture(crimeCanvas);
            const crimeMaterial = new THREE.SpriteMaterial({
                map: crimeTexture,
                transparent: true,
                opacity: 0.0,
            });

            const crimeSprite = new THREE.Sprite(crimeMaterial);
            crimeSprite.position.set(agent.currentLocation.x, 0.8, agent.currentLocation.y);
            crimeSprite.scale.set(0.35, 0.35, 1);
            crimeSprite.visible = false;
            crimeSprite.userData.pulseStart = Date.now();

            this.scene.add(crimeSprite);
            this.agentCriminalMeshes.set(agent.id.toString(), crimeSprite);

            // Create camera icon sprite (hidden by default)
            const cameraCanvas = document.createElement('canvas');
            cameraCanvas.width = 64;
            cameraCanvas.height = 64;
            const cameraCtx = cameraCanvas.getContext('2d');

            cameraCtx.clearRect(0, 0, 64, 64);
            // Draw camera icon: cyan circle with camera body
            cameraCtx.fillStyle = 'rgba(0, 191, 255, 0.9)';
            cameraCtx.beginPath();
            cameraCtx.arc(32, 32, 20, 0, Math.PI * 2);
            cameraCtx.fill();

            // Camera lens circle
            cameraCtx.strokeStyle = '#000000';
            cameraCtx.lineWidth = 2;
            cameraCtx.beginPath();
            cameraCtx.arc(32, 32, 10, 0, Math.PI * 2);
            cameraCtx.stroke();

            // Flash (top-left corner of circle)
            cameraCtx.fillStyle = '#ffff00';
            cameraCtx.fillRect(20, 18, 4, 4);

            const cameraTexture = new THREE.CanvasTexture(cameraCanvas);
            const cameraMaterial = new THREE.SpriteMaterial({
                map: cameraTexture,
                transparent: true,
                opacity: 0.0,
            });

            const cameraSprite = new THREE.Sprite(cameraMaterial);
            cameraSprite.position.set(agent.currentLocation.x, 1.0, agent.currentLocation.y);
            cameraSprite.scale.set(0.35, 0.35, 1);
            cameraSprite.visible = false;
            cameraSprite.userData.pulseStart = Date.now();

            this.scene.add(cameraSprite);
            this.agentPhotoCameraMeshes.set(agent.id.toString(), cameraSprite);
        }

        // Create initial path visualizations for the player
        this.updateAgentPaths(agentsToRender);
        this.updateObjectiveHighlights(playerAgent);
    }

    /**
     * Clear all existing agent-related meshes from the scene
     */
    clearAgentVisuals() {
        const removeAll = (map) => {
            for (const mesh of map.values()) {
                this.scene.remove(mesh);
            }
            map.clear();
        };

        removeAll(this.agentMeshes);
        removeAll(this.agentAuraMeshes);
        removeAll(this.agentInjuryMeshes);
        removeAll(this.agentCriminalMeshes);
        removeAll(this.agentPhotoCameraMeshes);
        removeAll(this.agentRoleRingMeshes);
        removeAll(this.agentRoleLabelMeshes);
        removeAll(this.agentPathMeshes);
        this.agentAnimations.clear();
        this.clearObjectiveHighlights();
    }

    /**
     * Create objective highlight mesh (ring + beacon)
     * @param {number} color - Hex color
     * @returns {THREE.Group}
     */
    createObjectiveHighlightMesh(color) {
        const group = new THREE.Group();

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.45, 0.06, 12, 24),
            new THREE.MeshStandardMaterial({
                color,
                emissive: color,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.85,
            })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.08;

        const beacon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.7, 10),
            new THREE.MeshStandardMaterial({
                color,
                emissive: color,
                emissiveIntensity: 0.6,
                transparent: true,
                opacity: 0.7,
            })
        );
        beacon.position.y = 0.45;

        group.add(ring, beacon);
        this.scene.add(group);
        return group;
    }

    /**
     * Remove objective highlights from scene
     */
    clearObjectiveHighlights() {
        for (const key of Object.keys(this.objectiveHighlightMeshes)) {
            const mesh = this.objectiveHighlightMeshes[key];
            if (mesh) {
                this.scene.remove(mesh);
                this.objectiveHighlightMeshes[key] = null;
            }
        }

        const clearMulti = (map) => {
            map.forEach((mesh) => this.scene.remove(mesh));
            map.clear();
        };

        clearMulti(this.multiObjectiveHighlightMeshes.hospitals);
        clearMulti(this.multiObjectiveHighlightMeshes.jails);
    }

    /**
     * Sync multiple objective highlights to exact coordinates.
     * @param {Map<string,THREE.Group>} highlightMap
     * @param {Array<{x:number,y:number}>} locations
     * @param {number} color
     */
    syncMultiObjectiveHighlights(highlightMap, locations, color) {
        const desiredKeys = new Set();

        (locations || []).forEach((location) => {
            if (!location) {
                return;
            }

            const key = `${location.x},${location.y}`;
            desiredKeys.add(key);

            let highlight = highlightMap.get(key);
            if (!highlight) {
                highlight = this.createObjectiveHighlightMesh(color);
                highlightMap.set(key, highlight);
            }

            highlight.visible = true;
            highlight.position.set(location.x, 0.02, location.y);
        });

        highlightMap.forEach((highlight, key) => {
            if (!desiredKeys.has(key)) {
                this.scene.remove(highlight);
                highlightMap.delete(key);
            }
        });
    }

    /**
     * Update home/task/office highlights for player
     * Also shows injury hospital glow, criminal jail glow, and cafe task glow
     * @param {Agent|null} player
     */
    updateObjectiveHighlights(player) {
        if (!player) {
            this.clearObjectiveHighlights();
            return;
        }

        // Create home highlight (green)
        if (!this.objectiveHighlightMeshes.home) {
            this.objectiveHighlightMeshes.home = this.createObjectiveHighlightMesh(0x51cf66);
        }
        this.objectiveHighlightMeshes.home.position.set(player.homeLocation.x, 0.02, player.homeLocation.y);
        this.objectiveHighlightMeshes.home.visible = true;

        // Create office highlight (blue)
        if (!this.objectiveHighlightMeshes.office) {
            this.objectiveHighlightMeshes.office = this.createObjectiveHighlightMesh(0x4da6ff);
        }
        this.objectiveHighlightMeshes.office.position.set(player.jobLocation.x, 0.02, player.jobLocation.y);
        this.objectiveHighlightMeshes.office.visible = true;

        // Handle active task highlight (yellow) or cafe highlight if available
        const activeTask = player.tasksQueue
            ? player.tasksQueue.find(task => !task.completed)
            : null;

        // Create cafe highlight (yellow) - shows when agent has cafe task
        if (!this.objectiveHighlightMeshes.cafe) {
            this.objectiveHighlightMeshes.cafe = this.createObjectiveHighlightMesh(0xffd43b);
        }
        if (!this.objectiveHighlightMeshes.task) {
            this.objectiveHighlightMeshes.task = this.createObjectiveHighlightMesh(0xffd43b);
        }

        // Determine which task highlight to show
        if (activeTask && activeTask.location) {
            const isCafeTask = activeTask.type === 'CAFE';
            
            if (isCafeTask) {
                // Show cafe glow at cafe location
                this.objectiveHighlightMeshes.cafe.visible = true;
                this.objectiveHighlightMeshes.cafe.position.set(activeTask.location.x, 0.02, activeTask.location.y);
                this.objectiveHighlightMeshes.task.visible = false;
            } else {
                // Show generic task glow at task location
                this.objectiveHighlightMeshes.task.visible = true;
                this.objectiveHighlightMeshes.task.position.set(activeTask.location.x, 0.02, activeTask.location.y);
                this.objectiveHighlightMeshes.cafe.visible = false;
            }
        } else {
            this.objectiveHighlightMeshes.task.visible = false;
            this.objectiveHighlightMeshes.cafe.visible = false;
        }

        // Show all hospital objectives when injured
        const hospitalLocations = (player.isInjured && this.board && this.board.specialLocations)
            ? (this.board.specialLocations.hospitals || [])
            : [];
        this.syncMultiObjectiveHighlights(
            this.multiObjectiveHighlightMeshes.hospitals,
            hospitalLocations,
            0xffffff
        );

        // Show all jail objectives when criminal
        const jailLocations = (player.isCriminal && this.board && this.board.specialLocations)
            ? (this.board.specialLocations.jails || [])
            : [];
        this.syncMultiObjectiveHighlights(
            this.multiObjectiveHighlightMeshes.jails,
            jailLocations,
            0xba68c8
        );

        // Legacy single-target meshes disabled (multi-highlight mode)
        if (this.objectiveHighlightMeshes.injury) {
            this.objectiveHighlightMeshes.injury.visible = false;
        }
        if (this.objectiveHighlightMeshes.criminal) {
            this.objectiveHighlightMeshes.criminal.visible = false;
        }
    }

    /**
     * Create/update multi-segment path visualization for agents
     * Shows: home → task1 → task2 → ... → job in different colors
     * @param {Array} agents - Array of Agent objects
     */
    updateAgentPaths(agents) {
        const agentsToRender = Array.isArray(agents) ? agents : [];

        for (const agent of agentsToRender) {
            const key = agent.id.toString();
            
            // Remove old path if exists
            const oldPath = this.agentPathMeshes.get(key);
            if (oldPath) {
                this.scene.remove(oldPath);
                this.agentPathMeshes.delete(key);
            }

            if (!agent.plannedPath || agent.plannedPath.length === 0) {
                continue;
            }

            // Build path segments based on destinations
            const segments = this.buildPathSegments(agent);
            if (segments.length === 0) continue;

            // Create multi-color line path
            const positions = [];
            const colors = [];

            let currentPos = agent.homeLocation;
            positions.push(currentPos.x, 0.1, currentPos.y);

            for (const segment of segments) {
                const dest = segment.destination;
                positions.push(dest.x, 0.1, dest.y);

                // Add color based on segment type
                const color = segment.color;
                for (let i = 0; i < 2; i++) {
                    colors.push(color.r, color.g, color.b);
                }
            }

            // Create line geometry
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));

            const material = new THREE.LineBasicMaterial({
                vertexColors: true,
                linewidth: 2,
                opacity: 0.6,
                transparent: true,
            });

            const path = new THREE.Line(geometry, material);
            path.userData.agentId = key;

            this.scene.add(path);
            this.agentPathMeshes.set(key, path);
        }
    }

    /**
     * Build path segments showing journey: home → tasks → job
     * Each segment has a different color based on type
     * @param {Agent} agent - Agent object
     * @returns {Array} Array of {destination, color, type} segments
     */
    buildPathSegments(agent) {
        const segments = [];

        // Define colors for different segment types
        const colors = {
            task: new THREE.Color(0xff9500),      // Orange for tasks
            job: new THREE.Color(0x00ff00),       // Green for job destination
            jail: new THREE.Color(0xff4444),      // Red for jail
            hospital: new THREE.Color(0xff66ff),  // Magenta for hospital
        };

        // Add jail segment if needed
        if (agent.mustVisitJail && agent.jailTaskLocation) {
            segments.push({
                destination: agent.jailTaskLocation,
                color: colors.jail,
                type: 'JAIL',
            });
        }

        // Add hospital segment if needed
        if (agent.mustVisitHospital && agent.hospitalTaskLocation) {
            segments.push({
                destination: agent.hospitalTaskLocation,
                color: colors.hospital,
                type: 'HOSPITAL',
            });
        }

        // Add task segments (in order)
        for (const task of agent.tasksQueue) {
            if (!task.completed) {
                segments.push({
                    destination: task.location,
                    color: colors.task,
                    type: 'TASK',
                });
            }
        }

        // Add job destination at the end
        segments.push({
            destination: agent.jobLocation,
            color: colors.job,
            type: 'JOB',
        });

        return segments;
    }

    /**
     * Update agent mesh positions and colors based on current state
     * Updates positions and colors based on agent status
     * @param {Array} agents - Array of Agent objects
     */
    updateAgents(agents) {
        const agentsToRender = Array.isArray(agents) ? agents : [];
        const playerAgent = agentsToRender.length > 0 ? agentsToRender[0] : null;

        for (const agent of agentsToRender) {
            const key = agent.id.toString();
            const mesh = this.agentMeshes.get(key);

            if (!mesh) continue;

            // Get target position
            const targetPos = new THREE.Vector3(
                agent.currentLocation.x,
                0.5,
                agent.currentLocation.y
            );

            // Check if position changed - start animation if needed
            const currentPos = mesh.position.clone();
            const distance = currentPos.distanceTo(targetPos);
            
            if (distance > 0.01) {
                // Position changed - start animation
                const fromPos = currentPos.clone();
                this.animateAgentMovement(key, fromPos, targetPos);
            }

            // Update color based on status
            if (agent.status === Agent.STATUS.FAILED) {
                // Failed: black
                mesh.material.color.setHex(0x000000);
                mesh.material.emissive.setHex(0x000000);
            } else if (agent.status === Agent.STATUS.ARRIVED) {
                // Arrived: gold
                mesh.material.color.setHex(0xffd700);
                mesh.material.emissive.setHex(0xffd700);
            } else {
                // Active: use original agent color
                const color = new THREE.Color(agent.color || '#4da6ff');
                mesh.material.color.copy(color);
                mesh.material.emissive.copy(color);
            }

            // Update special agent aura
            const aura = this.agentAuraMeshes.get(key);
            if (aura) {
                aura.position.set(agent.currentLocation.x, 0.28, agent.currentLocation.y);

                const shouldShow = agent.hasAbility && agent.abilityType === 'ROADBLOCK';
                if (shouldShow && !aura.visible) {
                    aura.visible = true;
                    aura.userData.fadeState = 'in';
                    aura.userData.fadeStart = Date.now();
                    aura.material.opacity = 0.0;
                } else if (!shouldShow && aura.visible && aura.userData.fadeState !== 'out') {
                    aura.userData.fadeState = 'out';
                    aura.userData.fadeStart = Date.now();
                }
            }

            // Update injury icon
            const injuryIcon = this.agentInjuryMeshes.get(key);
            if (injuryIcon) {
                injuryIcon.position.set(agent.currentLocation.x, 0.9, agent.currentLocation.y);

                if (agent.isInjured) {
                    if (!injuryIcon.visible) {
                        injuryIcon.visible = true;
                        injuryIcon.material.opacity = 0.9;
                        injuryIcon.userData.pulseStart = Date.now();
                    }
                } else if (injuryIcon.visible) {
                    injuryIcon.visible = false;
                    injuryIcon.material.opacity = 0.0;
                }
            }

            // Update criminal icon
            const criminalIcon = this.agentCriminalMeshes.get(key);
            if (criminalIcon) {
                criminalIcon.position.set(agent.currentLocation.x, 0.8, agent.currentLocation.y);

                if (agent.isCriminal) {
                    if (!criminalIcon.visible) {
                        criminalIcon.visible = true;
                        criminalIcon.material.opacity = 0.9;
                        criminalIcon.userData.pulseStart = Date.now();
                    }
                } else if (criminalIcon.visible) {
                    criminalIcon.visible = false;
                    criminalIcon.material.opacity = 0.0;
                }
            }

            // Update camera icon (photo taking)
            const cameraIcon = this.agentPhotoCameraMeshes.get(key);
            if (cameraIcon) {
                cameraIcon.position.set(agent.currentLocation.x, 1.0, agent.currentLocation.y);

                if (agent.takingPhoto) {
                    if (!cameraIcon.visible) {
                        cameraIcon.visible = true;
                        cameraIcon.material.opacity = 0.9;
                        cameraIcon.userData.pulseStart = Date.now();
                    }
                } else if (cameraIcon.visible) {
                    cameraIcon.visible = false;
                    cameraIcon.material.opacity = 0.0;
                }
            }

            const roleRing = this.agentRoleRingMeshes.get(key);
            if (roleRing) {
                roleRing.position.set(agent.currentLocation.x, 0.18, agent.currentLocation.y);
            }

            const roleLabel = this.agentRoleLabelMeshes.get(key);
            if (roleLabel) {
                roleLabel.position.set(
                    agent.currentLocation.x,
                    agent.isPlayerControlled ? 1.25 : 1.05,
                    agent.currentLocation.y
                );
            }
        }

        this.updateObjectiveHighlights(playerAgent);
    }

    /**
     * Animate camera zoom
     * @param {number} targetDistance - Target camera distance
     * @param {number} duration - Animation duration in seconds
     */
    animateCameraZoom(targetDistance, duration = 0.8) {
        const currentDistance = this.cameraDistance;
        this.cameraAnimation = {
            from: currentDistance,
            to: targetDistance,
            progress: 0,
            duration: duration,
            startTime: Date.now()
        };
    }

    /**
     * Get current camera zoom distance
     * @returns {number}
     */
    getZoomDistance() {
        return this.cameraDistance;
    }

    /**
     * Set camera zoom distance
     * @param {number} distance
     */
    setZoomDistance(distance) {
        if (!this.camera) {
            return;
        }

        const clampedDistance = Math.min(80, Math.max(20, distance));
        this.cameraAnimation = null;
        this.cameraDistance = clampedDistance;

        const target = (this.controls && this.controls.target)
            ? this.controls.target.clone()
            : new THREE.Vector3(this.boardCenter.x, 0, this.boardCenter.y);

        const offset = this.camera.position.clone().sub(target);
        if (offset.lengthSq() < 0.0001) {
            const defaultAngle = Math.PI / 4;
            offset.set(Math.cos(defaultAngle), 0.75, Math.sin(defaultAngle));
        }

        offset.normalize().multiplyScalar(clampedDistance);
        this.camera.position.copy(target.clone().add(offset));
        this.camera.lookAt(target);

        if (this.controls) {
            this.controls.minDistance = 20;
            this.controls.maxDistance = 80;
            this.controls.update();
        }
    }

    /**
     * Update camera animation
     */
    updateCameraAnimation() {
        if (!this.cameraAnimation) return;

        const now = Date.now();
        const elapsed = (now - this.cameraAnimation.startTime) / 1000;
        this.cameraAnimation.progress = Math.min(elapsed / this.cameraAnimation.duration, 1.0);

        // Ease-in-out cubic
        const t = this.cameraAnimation.progress;
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        // Interpolate camera distance
        this.cameraDistance = this.cameraAnimation.from + 
            (this.cameraAnimation.to - this.cameraAnimation.from) * eased;

        // Update camera position
        const angle = Math.PI / 4;
        this.camera.position.set(
            this.boardCenter.x + this.cameraDistance * Math.cos(angle),
            this.cameraHeight,
            this.boardCenter.y + this.cameraDistance * Math.sin(angle)
        );
        this.camera.lookAt(this.boardCenter.x, 0, this.boardCenter.y);

        // Remove animation when complete
        if (this.cameraAnimation.progress >= 1.0) {
            this.cameraAnimation = null;
        }
    }

    /**
     * Update compass dial rotation and heading label based on camera orientation
     */
    updateCompass() {
        if (!this.camera || !this.compassDialElement) {
            return;
        }

        const targetX = this.controls ? this.controls.target.x : this.boardCenter.x;
        const targetZ = this.controls ? this.controls.target.z : this.boardCenter.y;

        const toTargetX = targetX - this.camera.position.x;
        const toTargetZ = targetZ - this.camera.position.z;

        const angleRad = Math.atan2(toTargetX, -toTargetZ);
        const angleDeg = (angleRad * 180 / Math.PI + 360) % 360;

        // Rotate dial so cardinal letters follow map orientation while top marker stays fixed
        this.compassDialElement.style.transform = `rotate(${-angleDeg}deg)`;

        if (this.compassReadingElement) {
            const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            const idx = Math.round(angleDeg / 45) % dirs.length;
            this.compassReadingElement.textContent = `Up: ${dirs[idx]}`;
        }
    }

    /**
     * Animate agent movement from one position to another
     * @param {string} agentId - Agent identifier
     * @param {THREE.Vector3} from - Starting position
     * @param {THREE.Vector3} to - Target position
     */
    animateAgentMovement(agentId, from, to) {
        this.agentAnimations.set(agentId, {
            from: from.clone(),
            to: to.clone(),
            progress: 0,
            duration: 0.5, // 0.5 seconds
            startTime: Date.now()
        });
    }

    /**
     * Create particle effect at location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} type - 'accident' or 'glow'
     */
    createParticleEffect(x, y, type = 'accident') {
        const key = `${x},${y}`;
        
        if (type === 'accident') {
            // Create small particle burst
            const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xff6b6b,
                transparent: true,
                opacity: 0.8
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.set(x, 0.5, y);
            
            this.scene.add(particle);
            this.particles.set(key, {
                mesh: particle,
                startTime: Date.now(),
                duration: 1.5,
                type: 'accident'
            });
        }
    }

    /**
     * Update particle effects
     */
    updateParticles() {
        const now = Date.now();
        const particlesToRemove = [];

        this.particles.forEach((particle, key) => {
            const elapsed = (now - particle.startTime) / 1000;
            const progress = elapsed / particle.duration;

            if (progress >= 1.0) {
                this.scene.remove(particle.mesh);
                particlesToRemove.push(key);
            } else {
                // Animate based on type
                if (particle.type === 'accident') {
                    // Rise and fade
                    particle.mesh.position.y = 0.5 + progress * 2;
                    particle.mesh.material.opacity = 0.8 * (1 - progress);
                    particle.mesh.scale.setScalar(1 + progress * 2);
                }
            }
        });

        particlesToRemove.forEach(key => this.particles.delete(key));
    }

    /**
     * Add pulsing glow to active agents
     */
    updateAgentGlow() {
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 3) * 0.5 + 0.5; // 0 to 1

        this.agentMeshes.forEach((mesh, agentId) => {
            // Add subtle pulsing scale to active agents
            const scale = 1.0 + pulse * 0.1;
            mesh.scale.setScalar(scale);

            const roleRing = this.agentRoleRingMeshes.get(agentId);
            if (roleRing) {
                const isPlayer = roleRing.userData && roleRing.userData.isPlayer;
                const ringScale = isPlayer ? (1.0 + pulse * 0.18) : (1.0 + pulse * 0.08);
                roleRing.scale.setScalar(ringScale);
                roleRing.material.emissiveIntensity = isPlayer ? (0.75 + pulse * 0.45) : (0.45 + pulse * 0.2);
                roleRing.position.set(mesh.position.x, 0.18, mesh.position.z);
            }

            const roleLabel = this.agentRoleLabelMeshes.get(agentId);
            if (roleLabel) {
                const baseY = roleLabel.scale.x > 0.9 ? 1.25 : 1.05;
                roleLabel.position.set(mesh.position.x, baseY + pulse * 0.03, mesh.position.z);
            }
        });

        // Update special agent aura pulse and transitions
        this.agentAuraMeshes.forEach((aura) => {
            if (!aura.visible) return;

            const now = Date.now();
            const fadeDuration = 250; // ms

            if (aura.userData.fadeState === 'in') {
                const progress = Math.min((now - aura.userData.fadeStart) / fadeDuration, 1);
                aura.material.opacity = 0.85 * progress;
                const scale = 0.6 + 0.4 * progress;
                aura.scale.setScalar(scale);
                if (progress >= 1) {
                    aura.userData.fadeState = null;
                }
                return;
            }

            if (aura.userData.fadeState === 'out') {
                const progress = Math.min((now - aura.userData.fadeStart) / fadeDuration, 1);
                aura.material.opacity = 0.85 * (1 - progress);
                const scale = 1.0 - 0.4 * progress;
                aura.scale.setScalar(scale);
                if (progress >= 1) {
                    aura.userData.fadeState = null;
                    aura.visible = false;
                }
                return;
            }

            const auraScale = 1.0 + pulse * 0.08;
            aura.scale.setScalar(auraScale);
            aura.material.opacity = 0.75 + pulse * 0.2;
            aura.material.emissiveIntensity = 0.6 + pulse * 0.4;
        });

        this.agentInjuryMeshes.forEach((icon) => {
            if (!icon.visible) return;

            const pulseScale = 1.0 + pulse * 0.2;
            icon.scale.set(0.35 * pulseScale, 0.35 * pulseScale, 1);
            icon.material.opacity = 0.7 + pulse * 0.3;
        });

        this.agentCriminalMeshes.forEach((icon) => {
            if (!icon.visible) return;

            const pulseScale = 1.0 + pulse * 0.2;
            icon.scale.set(0.35 * pulseScale, 0.35 * pulseScale, 1);
            icon.material.opacity = 0.7 + pulse * 0.3;
        });

        this.agentPhotoCameraMeshes.forEach((icon) => {
            if (!icon.visible) return;

            const pulseScale = 1.0 + pulse * 0.25;
            icon.scale.set(0.35 * pulseScale, 0.35 * pulseScale, 1);
            icon.material.opacity = 0.8 + pulse * 0.2;
        });
    }

    /**
     * Update all agent animations
     * Called each frame to interpolate positions
     */
    updateAgentAnimations() {
        const now = Date.now();
        const animationsToRemove = [];

        this.agentAnimations.forEach((anim, agentId) => {
            const mesh = this.agentMeshes.get(agentId);
            if (!mesh) {
                animationsToRemove.push(agentId);
                return;
            }

            // Calculate elapsed time in seconds
            const elapsed = (now - anim.startTime) / 1000;
            
            // Calculate progress (0 to 1)
            anim.progress = Math.min(elapsed / anim.duration, 1.0);

            // Apply easing (ease-out cubic for smooth deceleration)
            const eased = 1 - Math.pow(1 - anim.progress, 3);

            // Interpolate position using lerp
            mesh.position.lerpVectors(anim.from, anim.to, eased);

            // Remove animation when complete
            if (anim.progress >= 1.0) {
                animationsToRemove.push(agentId);
            }
        });

        // Clean up completed animations
        animationsToRemove.forEach(id => this.agentAnimations.delete(id));
    }

    /**
     * Show roadblock placement preview
     * @param {number} x - Tile x coordinate
     * @param {number} y - Tile y coordinate
     */
    showBlockPreview(x, y) {
        if (!this.blockPreview) {
            // Create preview mesh (semi-transparent barrier)
            const geometry1 = new THREE.BoxGeometry(0.8, 0.4, 0.1);
            const geometry2 = new THREE.BoxGeometry(0.1, 0.4, 0.8);
            const material = new THREE.MeshStandardMaterial({
                color: 0x4da6ff, // Blue for player blocks
                transparent: true,
                opacity: 0.5,
                emissive: 0x4da6ff,
                emissiveIntensity: 0.3
            });
            
            const mesh1 = new THREE.Mesh(geometry1, material);
            const mesh2 = new THREE.Mesh(geometry2, material.clone());
            
            this.blockPreview = new THREE.Group();
            this.blockPreview.add(mesh1);
            this.blockPreview.add(mesh2);
            
            this.scene.add(this.blockPreview);
        }
        
        this.blockPreview.position.set(x, 0.2, y);
        this.blockPreview.visible = true;
        
        // Pulse animation
        const time = Date.now() / 1000;
        const scale = 1.0 + Math.sin(time * 5) * 0.1;
        this.blockPreview.scale.setScalar(scale);
    }

    /**
     * Hide roadblock placement preview
     */
    hideBlockPreview() {
        if (this.blockPreview) {
            this.blockPreview.visible = false;
        }
    }

    /**
     * Update commute-time lighting based on turn number (7:00 AM to 9:00 AM)
     * @param {number} turn - Current turn number
     */
    updateCommuteLighting(turn) {
        this.currentTurn = turn;
        
        if (!this.directionalLight || !this.ambientLight) return;

        const progress = Math.min(Math.max(turn / Math.max(this.maxTurns, 1), 0), 1);
        const lightColor = new THREE.Color().lerpColors(
            new THREE.Color(0xffc78a),
            new THREE.Color(0xfff2d6),
            progress
        );
        const ambientColor = new THREE.Color().lerpColors(
            new THREE.Color(0x9fb6d8),
            new THREE.Color(0xc9ddf2),
            progress
        );
        const skyColor = new THREE.Color().lerpColors(
            new THREE.Color(0xd9e8ff),
            new THREE.Color(0xf2f8ff),
            progress
        );
        const intensity = 0.78 + (progress * 0.3);

        // Apply lighting changes with smooth transition
        this.directionalLight.color.copy(lightColor);
        this.directionalLight.intensity = intensity;
        this.ambientLight.color.copy(ambientColor);

        if (this.scene) {
            this.scene.background.copy(skyColor);
            if (this.scene.fog) {
                this.scene.fog.color.copy(skyColor);
            }
        }
    }

    /**
     * Update traffic visualization for congestion and blocking
     * Creates overlay meshes for congested and blocked tiles
     * @param {Board} board - Board instance with tile data
     */
    updateTraffic(board) {
        // Clear existing traffic overlays
        this.trafficOverlays.forEach((mesh) => {
            this.scene.remove(mesh);
        });
        this.trafficOverlays.clear();

        // Iterate through all tiles
        for (let y = 0; y < board.height; y++) {
            for (let x = 0; x < board.width; x++) {
                const tile = board.getTile(x, y);
                if (!tile) continue;

                const key = `${x},${y}`;

                // Handle traffic congestion
                if (tile.congestion && tile.congestion > 0) {
                    // Create semi-transparent red overlay
                    const opacity = Math.min(tile.congestion / 5, 1.0); // Scale 0.0 to 1.0

                    const geometry = new THREE.PlaneGeometry(0.95, 0.95);

                    const material = new THREE.MeshStandardMaterial({
                        color: 0xff0000,        // Red
                        transparent: true,
                        opacity: opacity,
                        metalness: 0.3,
                        roughness: 0.6,
                        emissive: 0xff0000,
                        emissiveIntensity: 0.2,
                    });

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.rotation.x = -Math.PI / 2;  // Lay flat
                    mesh.position.set(x, 0.15, y);   // Float above tile
                    mesh.receiveShadow = true;

                    this.scene.add(mesh);
                    this.trafficOverlays.set(key + '_congestion', mesh);
                }

                // Handle blocked tiles
                if (tile.isBlocked) {
                    // Create red X barrier using two rotated boxes
                    const boxSize = 0.15;
                    const boxLength = 1.2;

                    // First box (diagonal /)
                    const geometry1 = new THREE.BoxGeometry(boxSize, boxSize, boxLength);
                    const material = new THREE.MeshStandardMaterial({
                        color: 0xff0000,        // Red
                        metalness: 0.6,
                        roughness: 0.4,
                        emissive: 0xff0000,
                        emissiveIntensity: 0.4,
                    });

                    const mesh1 = new THREE.Mesh(geometry1, material);
                    mesh1.position.set(x, 0.4, y);
                    mesh1.rotation.z = Math.PI / 4;  // 45 degree rotation
                    mesh1.castShadow = true;
                    mesh1.receiveShadow = true;

                    // Second box (diagonal \)
                    const geometry2 = new THREE.BoxGeometry(boxSize, boxSize, boxLength);
                    const mesh2 = new THREE.Mesh(geometry2, material);
                    mesh2.position.set(x, 0.4, y);
                    mesh2.rotation.z = -Math.PI / 4;  // -45 degree rotation
                    mesh2.castShadow = true;
                    mesh2.receiveShadow = true;

                    this.scene.add(mesh1);
                    this.scene.add(mesh2);

                    // Store both meshes using same key (add to array or use different suffixes)
                    this.trafficOverlays.set(key + '_blocked_1', mesh1);
                    this.trafficOverlays.set(key + '_blocked_2', mesh2);
                }
            }
        }

    }

    /**
     * Add an agent mesh to the scene
     * @param {Agent} agent - Agent object with id, color, currentLocation
     * @returns {THREE.Mesh} Created mesh
     */
    addAgentMesh(agent) {
        const key = agent.id.toString();

        // Remove existing mesh if present
        if (this.agentMeshes.has(key)) {
            const oldMesh = this.agentMeshes.get(key);
            this.scene.remove(oldMesh);
        }

        // Create agent geometry (sphere)
        const geometry = new THREE.SphereGeometry(0.3, 16, 16);

        const color = new THREE.Color(agent.color || '#4da6ff');

        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.5,
            roughness: 0.3,
            emissive: color,
            emissiveIntensity: 0.3,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            agent.currentLocation.x,
            0.5,  // Height above ground
            agent.currentLocation.y
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.scene.add(mesh);
        this.agentMeshes.set(key, mesh);

        return mesh;
    }

    /**
     * Update agent mesh position
     * @param {Agent} agent - Agent with updated position
     */
    updateAgentPosition(agent) {
        const key = agent.id.toString();
        const mesh = this.agentMeshes.get(key);

        if (mesh) {
            mesh.position.set(
                agent.currentLocation.x,
                0.5,
                agent.currentLocation.y
            );
        }
    }

    /**
     * Update agent mesh color (for status changes)
     * @param {Agent} agent - Agent object
     * @param {string} color - Hex color string
     */
    updateAgentColor(agent, color) {
        const key = agent.id.toString();
        const mesh = this.agentMeshes.get(key);

        if (mesh && mesh.material) {
            const colorObj = new THREE.Color(color);
            mesh.material.color.copy(colorObj);
            mesh.material.emissive.copy(colorObj);
        }
    }

    /**
     * Remove agent mesh from scene
     * @param {Agent} agent - Agent to remove
     */
    removeAgentMesh(agent) {
        const key = agent.id.toString();
        const mesh = this.agentMeshes.get(key);

        if (mesh) {
            this.scene.remove(mesh);
            this.agentMeshes.delete(key);
        }
    }

    /**
     * Render the scene
     */
    render() {
        // Update controls (damping)
        if (this.controls) {
            this.controls.update();
        }
        
        // Update camera animation
        this.updateCameraAnimation();

        // Update compass orientation with camera movement
        this.updateCompass();
        
        // Update agent animations
        this.updateAgentAnimations();
        
        // Update particle effects
        this.updateParticles();
        
        // Update agent glow/pulse
        this.updateAgentGlow();

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Animate with requestAnimationFrame
     * @param {Function} callback - Optional callback for animation loop
     */
    animate(callback) {
        const loop = () => {
            requestAnimationFrame(loop);

            if (callback) {
                callback();
            }

            this.render();
        };

        loop();
    }

    /**
     * Handle window resize
     * Updates camera aspect ratio and renderer size
     */
    onWindowResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        const aspect = width / height;

        // Update camera
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();

        // Update renderer
        this.renderer.setSize(width, height);
    }

    /**
     * Dispose of renderer resources
     */
    dispose() {
        // Dispose geometries and materials
        this.tileMeshes.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        });

        this.agentMeshes.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        });

        this.clearObjectiveHighlights();

        // Dispose renderer
        this.renderer.dispose();

    }

    /**
     * Get tile information for tooltip
     * @param {number} x - Tile x coordinate
     * @param {number} y - Tile y coordinate
     * @returns {string} Tooltip text
     */
    getTileTooltip(x, y) {
        const tile = this.board.getTile(x, y);
        if (!tile) return null;

        const lines = [
            `Position: (${x}, ${y})`,
            `Type: ${Renderer.getTileTypeName(tile.type)}`,
        ];

        if (tile.isWalkable) {
            lines.push('Status: ✓ Walkable');
        } else {
            lines.push('Status: ✗ Non-walkable');
        }

        if (tile.congestion && tile.congestion > 0) {
            lines.push(`Congestion: ${tile.congestion}/5`);
        }

        if (tile.blockedByPlayer && tile.blockedByPlayer > 0) {
            lines.push(`Blocked: ${tile.blockedByPlayer} turn${tile.blockedByPlayer === 1 ? '' : 's'}`);
        }

        if (tile.disasterType) {
            lines.push(`Disaster: ${tile.disasterType}`);
        }

        return lines.join('\n');
    }

    /**
     * Get agent information for tooltip
     * @param {string} agentId - Agent ID
     * @param {Agent} agent - Agent object
     * @returns {string} Tooltip text
     */
    getAgentTooltip(agentId, agent) {
        if (!agent) return null;

        const lines = [
            `${agentId}`,
            `Status: ${agent.status}`,
            `Location: (${agent.currentLocation.x}, ${agent.currentLocation.y})`,
            `Turns Left: ${agent.turnsRemaining}/${agent.maxTurns}`,
        ];

        if (agent.hasAbility) {
            lines.push(`⚡ Special Agent - Charges: ${agent.abilityCharges}`);
        }

        if (agent.isInjured) {
            lines.push(`🏥 Injured - Hospital Required`);
        }

        if (agent.isCriminal) {
            lines.push(`⚖️ Criminal - Jail: ${agent.jailSentence} turns`);
        }

        if (agent.takingPhoto) {
            lines.push(`📷 Photo - ${agent.photoTurnsRemaining} turns`);
        }

        return lines.join('\n');
    }

    /**
     * Get a human-readable tile type name
     * @param {string} tileType - Tile type constant
     * @returns {string} Display name
     */
    static getTileTypeName(tileType) {
        const names = {
            'ROAD': 'Road',
            'BUILDING': 'Building',
            'CAFE': '☕ Cafe',
            'GAS_STATION': '⛽ Gas Station',
            'HOSPITAL': '🏥 Hospital',
            'JAIL': '⚖️ Jail',
            'POSTAL_OFFICE': '📮 Postal Office',
            'PARK': '🌳 Park',
            'MUSEUM': '🏛️ Museum',
            'TEMPLE': '⛩️ Temple',
            'HISTORIC_BUILDING': '🏛️ Historic Building',
            'PLAZA': '🏞️ Plaza',
            'BRIDGE': '🌉 Bridge',
            'FOUNTAIN': '⛲ Fountain',
            'CLOCK_TOWER': '🕐 Clock Tower',
            'SCULPTURE': '🎨 Sculpture',
        };

        return names[tileType] || tileType;
    }

    /**
     * Get scene statistics
     * @returns {Object} Stats with tile and agent counts
     */
    getStats() {
        return {
            tileCount: this.tileMeshes.size,
            agentCount: this.agentMeshes.size,
            cameraPosition: {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z,
            },
        };
    }
}

// Expose to browser global scope
if (typeof window !== 'undefined') {
    window.Renderer = Renderer;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Renderer;
}
