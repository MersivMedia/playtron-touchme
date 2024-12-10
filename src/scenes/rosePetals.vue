<script setup>
import { midi } from '~/use/midi';
import { notes, pitchColor, getCircleCoord } from '~/use/chromatone';
import { useScene } from '~/use/scene';
const { width, height } = useScene()

// Create multiple layers of circles with different scales and rotations
const layers = [
  { scale: 1.4, rotation: 0, z: 100 },
  { scale: 1.2, rotation: 15, z: 80 },
  { scale: 1.0, rotation: 30, z: 60 },
  { scale: 0.8, rotation: 45, z: 40 },
  { scale: 0.6, rotation: 60, z: 20 }
]

const rounds = computed(() => layers.map(layer => 
  new Array(12).fill(1).map((r, i) => {
    if (!midi.total.notes[i]) return {}
    return getCircleCoord(
      i, 
      12, 
      midi.total.notes[i] / midi.total.hits * width.value * layer.scale + 50,
      width.value, 
      height.value
    )
  })
))

const allLines = computed(() => {
  return layers.map((layer, layerIndex) => {
    const active = rounds.value[layerIndex].filter(dot => dot.x && dot.y)
    return active.map((dot, i) => {
      return { 
        x1: dot.x, 
        y1: dot.y, 
        x2: active[i === (active.length - 1) ? 0 : i + 1].x, 
        y2: active[i === (active.length - 1) ? 0 : i + 1].y,
      }
    })
  })
})

// Add time-based animation
const t = ref(0)
const animate = () => {
  t.value += 0.01
  requestAnimationFrame(animate)
}
onMounted(() => animate())

// Compute perspective transformations
const getLayerTransform = (layerIndex, baseRotation) => {
  const z = layers[layerIndex].z
  const wobble = Math.sin(t.value + layerIndex) * 5
  const pulse = midi.duration / 1000
  return `
    perspective(1000px)
    translateZ(${z * pulse}px)
    rotateY(${wobble}deg)
    rotate(${baseRotation}deg)
  `
}

// Add motion trails
const trailOpacity = computed(() => 
  Math.max(0.1, Math.min(0.8, midi.duration / 2000))
)

</script>

<template>
  <g>
    <!-- Motion trails -->
    <template v-for="(layer, layerIndex) in layers" :key="'trail-' + layerIndex">
      <g 
        class="motion-trail"
        v-for="offset in [1,2,3]" 
        :key="offset"
        :style="`opacity: ${trailOpacity * (1 - offset/4)}`"
        :transform="`translate(${Math.sin(t + offset) * 2}px, ${Math.cos(t + offset) * 2}px)`"
      >
        <circle
          class="mix-blend-hard-light"
          v-for="(coord, p) in rounds[layerIndex]"
          :key="p"
          :cx="coord.x || width / 2"
          :r="(12 - layerIndex * 2) * (1 - offset/4)"
          :cy="coord.y || height / 2"
          :fill="pitchColor(p, 5 - layerIndex)"
          :style="`filter: blur(${offset * 2}px)`"
          :opacity="0.3"
        />
      </g>
    </template>

    <!-- Main elements with enhanced depth -->
    <template v-for="(layer, layerIndex) in layers" :key="layerIndex">
      <g :transform="getLayerTransform(layerIndex, layer.rotation)">
        <line
          class="glow"
          v-for="(l, i) in 12"
          :key="l"
          :x1="width / 2"
          :x2="width / 2"
          :y1="height / 2"
          :y2="-height / 2"
          stroke-linecap="round"
          :stroke-width="midi?.note?.pitch === i && midi?.note?.attack ? midi.duration / (8 + layerIndex * 4) : 2"
          :stroke="pitchColor(i, 5 - layerIndex)"
          :transform-origin="`${width / 2} ${height / 2}`"
          :transform="`rotate(${30 * i})`"
          :opacity="0.9 - layerIndex * 0.15"
          :style="`
            transition: all 500ms cubic-bezier(0.4, 0, 0.2, 1);
            filter: blur(${layerIndex}px)
          `"
        />
        <circle
          class="mix-blend-hard-light"
          v-for="(coord, p) in rounds[layerIndex]"
          :key="p"
          :cx="coord.x || width / 2"
          :r="12 - layerIndex * 2"
          :cy="coord.y || height / 2"
          :fill="pitchColor(p, 5 - layerIndex)"
          stroke="white"
          :stroke-width="2"
          :transform-origin="`${coord.x} ${coord.y}`"
          :style="`
            transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
            transform: scale(${60 * midi.total.durations[p] / midi.total.duration});
            filter: blur(${layerIndex/2}px);
          `"
          :opacity="0.9 - layerIndex * 0.15"
        />
        <line
          class="mix-blend-screen"
          v-for="line in allLines[layerIndex]"
          :key="line"
          v-bind="line"
          :stroke="pitchColor(layerIndex * 2, 4)"
          :stroke-width="5 - layerIndex"
          stroke-linecap="round"
          :opacity="0.7 - layerIndex * 0.1"
          style="transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1)"
        />
      </g>
    </template>

    <!-- Enhanced central elements -->
    <g class="center-piece" :style="`transform: translateZ(${midi.duration/5}px)`">
      <line
        class="mix-blend-difference glow"
        :x1="width / 2"
        :x2="width / 2"
        :y1="height / 2 - midi.duration / 4 - 100"
        :y2="height / 2"
        :transform-origin="`${width / 2} ${height / 2}`"
        :transform="`
          rotate(${30 * midi?.note?.pitch || 0})
          scale(${1 + midi.duration/1000})
        `"
        stroke="white"
        stroke-width="6"
        stroke-linecap="round"
        style="transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1)"
      />
      <circle
        class="mix-blend-hard-light"
        :cx="width / 2"
        :cy="height / 2"
        :r="40"
        :transform-origin="`${width / 2} ${height / 2}`"
        :fill="pitchColor(midi?.note?.pitch, 5, midi?.note?.attack)"
        :style="`
          transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
          transform: scale(${1 + midi.duration / 800});
          filter: blur(${midi.duration/1000}px)
        `"
      />
    </g>
  </g>
</template>

<style scoped>
.glow {
  filter: drop-shadow(0 0 8px currentColor);
}

.motion-trail {
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

g {
  transform-style: preserve-3d;
}
</style>

<route lang="yaml">
name: rosePetals
title: Rose Petals
subtitle: by Assistant
</route> 