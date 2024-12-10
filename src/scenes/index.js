import { defineAsyncComponent } from 'vue'

export const scenes = {
  xmas: defineAsyncComponent(() => import('./XmasScene.vue')),
  panorama: defineAsyncComponent(() => import('./PanoramaScene.vue')),
  rosePetals: defineAsyncComponent(() => import('./rosePetals.vue'))
} 