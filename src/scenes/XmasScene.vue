<script setup>
import { midi } from '~/use/midi';
import { notes, pitchColor } from '~/use/chromatone';
import { useScene } from '~/use/scene';
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const { width, height } = useScene();
const container = ref(null);

// Three.js setup
let scene, camera, renderer;
const shapes = [];
const models = [];

// Physics parameters
const SHAPE_SIZE = 4;
const HOUSE_SCALE = 48;
const COLLISION_DAMPING = 0.3;
const MOVEMENT_SPEED = 0.06;
const ROTATION_SPEED = 0.01;
const RETURN_SPEED = 0.05;
const DAMPING = 0.92;
const INITIAL_RADIUS = 50;

// House will be at the center, other models around it
const modelPaths = [
    '/models/house.glb',
    '/models/cat.glb',
    '/models/elf.glb',
    '/models/penguin.glb',
    '/models/reindeer.glb',
    '/models/santa.glb',
    '/models/snowman.glb',
    '/models/Wall_e.glb'
];

// Function to load GLB models
const loadModel = (path) => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        console.log('Loading model:', path);
        loader.load(
            path,
            (gltf) => {
                const model = gltf.scene;
                // Scale based on model type
                const isHouse = path.includes('house');
                const scale = isHouse ? HOUSE_SCALE : SHAPE_SIZE * 3; // Triple size for non-house models
                model.scale.set(scale, scale, scale);
                console.log('Model loaded successfully:', path);
                
                // Debug model size and position
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                console.log('Model size:', path, size);
                
                models.push({
                    object: model,
                    animations: gltf.animations,
                    type: path.split('/').pop().split('.')[0]
                });
                resolve(model);
            },
            (xhr) => {
                console.log(path, (xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('Error loading model:', path, error);
                reject(error);
            }
        );
    });
};

// Initialize Three.js scene
const initThree = async () => {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a2a); // Keep a base color
    
    // Load background texture
    const textureLoader = new THREE.TextureLoader();
    const backgroundTexture = textureLoader.load('/images/winter_background.png', () => {
        console.log('Background texture loaded successfully');
    }, undefined, (error) => {
        console.error('Error loading background texture:', error);
    });
    
    // Create a large plane for the background
    const bgGeometry = new THREE.PlaneGeometry(1000, 500);
    const bgMaterial = new THREE.MeshBasicMaterial({ 
        map: backgroundTexture,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const bgPlane = new THREE.Mesh(bgGeometry, bgMaterial);
    bgPlane.position.set(0, 20, -200); // Adjust Y value to move up/down
    bgPlane.rotation.y = Math.PI; // Face the camera
    scene.add(bgPlane);
    
    camera = new THREE.PerspectiveCamera(75, width.value / height.value, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width.value, height.value);
    
    if (container.value) {
        container.value.appendChild(renderer.domElement);
    }
    
    // Enhanced lighting with stronger values
    const ambientLight = new THREE.AmbientLight(0xffffff, 4);
    const pointLight1 = new THREE.PointLight(0xff0000, 4);
    const pointLight2 = new THREE.PointLight(0x00ff00, 4);
    const pointLight3 = new THREE.PointLight(0xffffff, 6);
    
    pointLight1.position.set(30, 30, 30);
    pointLight2.position.set(-30, 30, -30);
    pointLight3.position.set(0, 40, 0);
    
    scene.add(ambientLight, pointLight1, pointLight2, pointLight3);
    
    // Adjust camera position for lower, more horizontal view
    camera.position.set(0, 0, 80); // Raised from -25 to -15
    camera.lookAt(0, -10, 0); // Adjusted look target
    
    // Helper function to ensure model is on ground
    const alignModelToGround = (model) => {
        const box = new THREE.Box3().setFromObject(model);
        const height = box.max.y - box.min.y;
        // Position model so its bottom is exactly on the ground
        const offset = box.min.y - model.position.y;
        model.position.y = -40 - offset; // Place bottom exactly at ground level
        return height;
    };
    
    // Load GLB models
    try {
        for (let i = 0; i < modelPaths.length; i++) {
            const path = modelPaths[i];
            console.log('Processing model:', path);
            const model = await loadModel(path);
            const isHouse = path.includes('house');
            
            if (isHouse) {
                model.position.set(0, -40, -30);
                model.rotation.y = Math.PI;
                // Align house to ground
                const houseHeight = alignModelToGround(model);
                console.log('House height:', houseHeight);
            } else {
                // Position other models in a semi-circle further from the house due to larger size
                const angleRange = 90;
                const angle = (-angleRange/2 + (angleRange/(modelPaths.length-2)) * (i-1)) * (Math.PI/180);
                const radius = INITIAL_RADIUS * 1.2; // Increase radius to accommodate larger models
                
                model.position.x = Math.sin(angle) * radius;
                model.position.y = -40;
                model.position.z = Math.cos(angle) * radius * 0.4;
                model.rotation.y = -angle;
                
                // Align model to ground and store height for movement
                const modelHeight = alignModelToGround(model);
                console.log(`${path} height:`, modelHeight);
                
                const shape = {
                    mesh: model,
                    velocity: new THREE.Vector3(),
                    angularVelocity: new THREE.Vector3(),
                    basePosition: new THREE.Vector3(model.position.x, model.position.y, model.position.z),
                    baseRotation: new THREE.Vector3(0, -angle, 0),
                    radius: SHAPE_SIZE * 3.6, // Increased collision radius for larger models
                    mass: 1,
                    type: path.split('/').pop().split('.')[0],
                    height: modelHeight,
                    groundOffset: 0
                };
                shapes.push(shape);
            }
            scene.add(model);
            console.log('Model added to scene:', path, 'at y:', model.position.y);
        }
    } catch (error) {
        console.error('Error in model loading process:', error);
    }
    
    // Add a larger ground plane
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -40; // Ground plane level
    
    scene.add(ground);
};

// Animation types
const ANIMATIONS = {
    FORWARD: 'forward',
    SIDE: 'side',
    JUMP: 'jump'
};

// Map each model to its possible animations
const modelAnimations = {
    'cat': [ANIMATIONS.FORWARD, ANIMATIONS.SIDE],
    'elf': [ANIMATIONS.SIDE, ANIMATIONS.JUMP],
    'penguin': [ANIMATIONS.FORWARD, ANIMATIONS.JUMP],
    'reindeer': [ANIMATIONS.FORWARD, ANIMATIONS.SIDE],
    'santa': [ANIMATIONS.JUMP, ANIMATIONS.SIDE],
    'snowman': [ANIMATIONS.FORWARD, ANIMATIONS.JUMP],
    'Wall_e': [ANIMATIONS.FORWARD, ANIMATIONS.SIDE, ANIMATIONS.JUMP] // Gets all three
};

// Animation parameters
const animationParams = {
    [ANIMATIONS.FORWARD]: {
        duration: 0.5,
        distance: 5,
        height: 1
    },
    [ANIMATIONS.SIDE]: {
        duration: 0.4,
        distance: 4
    },
    [ANIMATIONS.JUMP]: {
        duration: 0.5,
        height: 4
    }
};

// Map notes to animations for each model
const noteToAnimation = (note, modelType) => {
    const availableAnimations = modelAnimations[modelType];
    if (!availableAnimations) return null;

    // Map each model to specific note ranges (randomized)
    const noteRanges = {
        'cat': [0, 12],          // Spread out notes
        'elf': [1, 5],           // Mixed range
        'penguin': [2, 13],      // High and low
        'reindeer': [3, 8],      // Mid range
        'santa': [4, 14],        // Spread out
        'snowman': [6, 11],      // Higher range
        'Wall_e': [7, 9, 10]     // Clustered mid-range
    };

    const modelRange = noteRanges[modelType];
    if (!modelRange || !modelRange.includes(note)) {
        return null; // Note not in this model's range
    }

    // For Wall_e (has 3 animations)
    if (modelType === 'Wall_e') {
        const noteIndex = modelRange.indexOf(note); // 0, 1, or 2
        return availableAnimations[noteIndex];
    }
    
    // For other models (2 animations each)
    const noteIndex = modelRange.indexOf(note); // 0 or 1
    return availableAnimations[noteIndex];
};

// Animation state for each shape
const shapeAnimationState = new Map();

// Animation update function
const updateAnimation = (shape, deltaTime) => {
    const state = shapeAnimationState.get(shape);
    
    if (state) {
        // Active animation
        const params = animationParams[state.type];
        state.time += deltaTime;
        const progress = Math.min(state.time / params.duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease out

        switch (state.type) {
            case ANIMATIONS.FORWARD:
                const forwardMove = params.distance * ease;
                const smallHop = params.height * Math.sin(progress * Math.PI);
                shape.mesh.position.z = state.startZ + forwardMove;
                shape.mesh.position.y = state.startY + smallHop;
                break;

            case ANIMATIONS.SIDE:
                const sideMove = params.distance * Math.sin(progress * Math.PI * 2);
                shape.mesh.position.x = state.startX + sideMove;
                break;

            case ANIMATIONS.JUMP:
                const jumpHeight = params.height * Math.sin(progress * Math.PI);
                shape.mesh.position.y = state.startY + jumpHeight;
                break;
        }

        if (progress >= 1) {
            shapeAnimationState.delete(shape);
        }
    } else {
        // No active animation - smooth return to original position
        const currentPos = shape.mesh.position;
        const basePos = shape.basePosition;
        
        // Calculate distance to base position
        const dx = basePos.x - currentPos.x;
        const dy = basePos.y - currentPos.y;
        const dz = basePos.z - currentPos.z;
        
        // Smoothly move back to base position
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(dz) > 0.01) {
            currentPos.x += dx * RETURN_SPEED;
            currentPos.y += dy * RETURN_SPEED;
            currentPos.z += dz * RETURN_SPEED;
        }
        
        // Smooth rotation return
        const currentRotation = shape.mesh.rotation;
        const baseRotation = shape.baseRotation;
        const dr = baseRotation.y - currentRotation.y;
        if (Math.abs(dr) > 0.01) {
            currentRotation.y += dr * RETURN_SPEED;
        }
    }
};

// Start animation function
const startAnimation = (shape, type) => {
    const startPosition = shape.mesh.position.clone();
    const startRotation = shape.mesh.rotation.clone();
    shapeAnimationState.set(shape, {
        type,
        time: 0,
        startPosition,
        startRotation,
        startX: shape.mesh.position.x,
        startY: shape.mesh.position.y,
        startZ: shape.mesh.position.z
    });
};

// Animation loop
const animate = () => {
    if (!renderer) return;
    
    requestAnimationFrame(animate);
    
    const deltaTime = 0.016;
    
    shapes.forEach((shape, i) => {
        const attack = midi?.note?.attack;
        if (attack) {
            // Check if this note should trigger this model
            const note = midi?.note?.pitch || 0;
            const animationType = noteToAnimation(note, shape.type);
            if (animationType) {
                startAnimation(shape, animationType);
            }
        }
        
        updateAnimation(shape, deltaTime);
        shape.velocity.multiplyScalar(DAMPING);
    });
    
    renderer.render(scene, camera);
};

// Handle resize
const handleResize = () => {
    if (!camera || !renderer) return;
    camera.aspect = width.value / height.value;
    camera.updateProjectionMatrix();
    renderer.setSize(width.value, height.value);
};

// Lifecycle hooks
onMounted(() => {
    initThree();
    animate();
    window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    if (renderer) {
        renderer.dispose();
        for (const shape of shapes) {
            shape.mesh.geometry.dispose();
            shape.mesh.material.dispose();
        }
    }
});

// Watch for canvas size changes
watch([width, height], handleResize);
</script>

<template>
  <g>
    <foreignObject :width="width" :height="height">
      <div ref="container" class="xmas-scene"></div>
    </foreignObject>
  </g>
</template>

<style scoped>
.xmas-scene {
  width: 100%;
  height: 100%;
  position: relative;
}

.xmas-scene canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>

<route lang="yaml">
name: xmas
title: Christmas Scene
subtitle: 3D Holiday Village
</route> 