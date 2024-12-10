<script setup>
import { midi } from '~/use/midi';
import { notes, pitchColor } from '~/use/chromatone';
import { useScene } from '~/use/scene';
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import * as THREE from 'three';

const { width, height } = useScene();
const container = ref(null);

// List of 360° images to cycle through
const panoramaImages = [
    '/images/panorama1.jpg',
    '/images/panorama2.jpg',
    '/images/panorama3.jpg',
    '/images/panorama4.jpg',
    '/images/panorama5.jpg',
    '/images/panorama6.jpg',
    '/images/panorama7.jpg',
    '/images/panorama8.jpg',
    '/images/panorama9.jpg',
    '/images/panorama10.jpg',
    '/images/panorama11.jpg',
    '/images/panorama12.jpg',
    '/images/panorama13.jpg',
    '/images/panorama14.jpg',
    '/images/panorama15.jpg',
    '/images/panorama16.jpg',
    '/images/panorama17.jpg',
    '/images/panorama18.jpg',
    '/images/panorama19.jpg',
    '/images/panorama20.jpg',
    '/images/panorama21.jpg',
    '/images/panorama22.jpg',
    '/images/panorama23.jpg',
    '/images/panorama24.jpg',
    '/images/panorama25.jpg',
    '/images/panorama26.jpg',
    '/images/panorama27.jpg',
    '/images/panorama28.jpg',
    '/images/panorama29.jpg',
    '/images/panorama30.jpg'
];

// Three.js setup
let scene, camera, renderer;
let currentImageIndex = 0;
let isImageCycling = false; // Flag to prevent repeated cycling

// Camera parameters
const CAMERA_ROTATION_SPEED = 0.03; // Speed of continuous rotation
const CAMERA_MOVEMENT_SPEED = 0.2; // Reduced from 0.5
const RETURN_SPEED = 0.05;
const MAX_MOVEMENT_DISTANCE = 8; // Limit how far the camera can move from center

// Camera state
const cameraState = {
    targetRotation: new THREE.Vector3(),
    currentRotation: new THREE.Vector3(),
    targetPosition: new THREE.Vector3(),
    currentPosition: new THREE.Vector3()
};

// Initialize Three.js scene
const initThree = () => {
    scene = new THREE.Scene();
    
    // Create a sphere geometry for the panorama
    // Much smaller radius for 1920x1080 resolution
    const geometry = new THREE.SphereGeometry(20, 60, 40);
    // Flip the geometry inside out
    geometry.scale(-1, 1, 1);

    console.log('Available panorama images:', panoramaImages);

    // Load the first panorama texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
        panoramaImages[0],
        (texture) => {
            console.log('Initial panorama texture loaded successfully');
            // Optimize texture settings for lower resolution
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            
            const material = new THREE.MeshBasicMaterial({
                map: texture
            });
            const sphere = new THREE.Mesh(geometry, material);
            scene.add(sphere);
        },
        (progress) => {
            console.log('Initial panorama loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
            console.error('Error loading initial panorama:', error);
            const material = new THREE.MeshBasicMaterial({
                color: 0x808080,
                wireframe: true
            });
            const sphere = new THREE.Mesh(geometry, material);
            scene.add(sphere);
        }
    );

    // Setup camera with wider FOV
    camera = new THREE.PerspectiveCamera(70, width.value / height.value, 0.1, 1000);
    camera.position.set(0, 0, 0);

    // Setup renderer
    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width.value, height.value);
    
    if (container.value) {
        container.value.appendChild(renderer.domElement);
    }
};

// Load new panorama image
const loadPanorama = (index) => {
    console.log('Attempting to load panorama index:', index);
    
    // Handle wrapping around the array
    let newIndex = index;
    if (newIndex < 0) {
        newIndex = panoramaImages.length - 1;
        console.log('Wrapped to last image:', newIndex);
    }
    if (newIndex >= panoramaImages.length) {
        newIndex = 0;
        console.log('Wrapped to first image:', newIndex);
    }
    
    const imagePath = panoramaImages[newIndex];
    console.log('Loading image from path:', imagePath);
    
    // Create new texture loader for each load
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
        imagePath,
        (texture) => {
            console.log('Successfully loaded new texture:', imagePath);
            // Enable texture filtering for better quality
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            
            if (scene.children[0] && scene.children[0].material) {
                scene.children[0].material.map?.dispose(); // Clean up old texture
                scene.children[0].material.map = texture;
                scene.children[0].material.needsUpdate = true;
                currentImageIndex = newIndex;
                console.log('Updated to new image index:', currentImageIndex);
            } else {
                console.error('Scene or material not ready');
            }
        },
        (progress) => {
            const percent = Math.round(progress.loaded / progress.total * 100);
            console.log(`Loading progress for ${imagePath}: ${percent}%`);
        },
        (error) => {
            console.error('Error loading panorama:', imagePath);
            console.error('Error details:', error);
            console.error('Make sure the image exists at:', window.location.origin + imagePath);
        }
    );
};

// Handle MIDI input
const handleMidiInput = () => {
    if (!midi?.note) return;

    const note = midi.note.pitch;
    const attack = midi.note.attack;

    // Reset cycling flag when note is released
    if (!attack) {
        if (note === 8 || note === 9) {
            isImageCycling = false;
        }
        // Only reset up/down rotation and movement, not left/right rotation
        switch (note) {
            case 2: // Look up
            case 3: // Look down
                cameraState.targetRotation.x = 0;
                break;
            case 4: // Move forward
            case 5: // Move backward
            case 6: // Move left
            case 7: // Move right
                cameraState.targetPosition.set(0, 0, 0);
                break;
        }
        return;
    }

    // Handle non-continuous controls
    switch (note) {
        case 8: // Previous image
            if (!isImageCycling) {
                console.log('Note 8 triggered - Loading previous image');
                loadPanorama(currentImageIndex - 1);
                isImageCycling = true;
            }
            break;
        case 9: // Next image
            if (!isImageCycling) {
                console.log('Note 9 triggered - Loading next image');
                loadPanorama(currentImageIndex + 1);
                isImageCycling = true;
            }
            break;
        case 10: // Instant reset of everything
            cameraState.targetRotation.set(0, 0, 0);
            cameraState.targetPosition.set(0, 0, 0);
            cameraState.currentRotation.set(0, 0, 0);
            cameraState.currentPosition.set(0, 0, 0);
            break;
    }
};

// Animation loop
const animate = () => {
    if (!renderer) return;
    requestAnimationFrame(animate);

    handleMidiInput();

    // Handle continuous rotation and movement when notes are held
    if (midi?.note?.attack) {
        const note = midi.note.pitch;
        switch (note) {
            case 0: // Look left
                cameraState.currentRotation.y += CAMERA_ROTATION_SPEED;
                cameraState.targetRotation.y = cameraState.currentRotation.y; // Update target to maintain position
                break;
            case 1: // Look right
                cameraState.currentRotation.y -= CAMERA_ROTATION_SPEED;
                cameraState.targetRotation.y = cameraState.currentRotation.y; // Update target to maintain position
                break;
            case 2: // Look up
                cameraState.currentRotation.x = Math.min(
                    cameraState.currentRotation.x + CAMERA_ROTATION_SPEED,
                    Math.PI * 0.45
                );
                break;
            case 3: // Look down
                cameraState.currentRotation.x = Math.max(
                    cameraState.currentRotation.x - CAMERA_ROTATION_SPEED,
                    -Math.PI * 0.45
                );
                break;
            case 4: // Move forward
                cameraState.currentPosition.z = Math.min(
                    cameraState.currentPosition.z + CAMERA_MOVEMENT_SPEED,
                    MAX_MOVEMENT_DISTANCE
                );
                break;
            case 5: // Move backward
                cameraState.currentPosition.z = Math.max(
                    cameraState.currentPosition.z - CAMERA_MOVEMENT_SPEED,
                    -MAX_MOVEMENT_DISTANCE
                );
                break;
            case 6: // Move left
                cameraState.currentPosition.x = Math.max(
                    cameraState.currentPosition.x - CAMERA_MOVEMENT_SPEED,
                    -MAX_MOVEMENT_DISTANCE
                );
                break;
            case 7: // Move right
                cameraState.currentPosition.x = Math.min(
                    cameraState.currentPosition.x + CAMERA_MOVEMENT_SPEED,
                    MAX_MOVEMENT_DISTANCE
                );
                break;
        }
    } else {
        // Only lerp x rotation and position, leave y rotation as is
        cameraState.currentRotation.x = THREE.MathUtils.lerp(
            cameraState.currentRotation.x,
            cameraState.targetRotation.x,
            RETURN_SPEED
        );
        cameraState.currentPosition.lerp(cameraState.targetPosition, RETURN_SPEED);
    }

    // Apply camera transformations
    camera.rotation.x = cameraState.currentRotation.x;
    camera.rotation.y = cameraState.currentRotation.y;
    camera.rotation.z = cameraState.currentRotation.z;
    camera.position.x = cameraState.currentPosition.x;
    camera.position.y = cameraState.currentPosition.y;
    camera.position.z = cameraState.currentPosition.z;

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
        scene.children[0].geometry.dispose();
        scene.children[0].material.dispose();
        scene.children[0].material.map?.dispose();
    }
});

// Watch for canvas size changes
watch([width, height], handleResize);
</script>

<template>
  <g>
    <foreignObject :width="width" :height="height">
      <div ref="container" class="panorama-scene"></div>
    </foreignObject>
  </g>
</template>

<style scoped>
.panorama-scene {
  width: 100%;
  height: 100%;
  position: relative;
}

.panorama-scene canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>

<route lang="yaml">
name: panorama
title: 360° Panorama
subtitle: Immersive View
</route> 