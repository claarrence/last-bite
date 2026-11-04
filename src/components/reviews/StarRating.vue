<script setup>
import { computed, ref } from 'vue'

// Shows 1–5 stars. When not readonly, the stars are radio buttons, so mouse,
// touch and keyboard (arrow keys) all work, and the parent receives the choice
// through the 'select' event.
const props = defineProps({
  rating: { type: Number, default: 0 },
  readonly: { type: Boolean, default: false },
  // Radio group name; must be unique on the page.
  name: { type: String, default: 'rating' },
})
const emit = defineEmits(['select'])

const stars = [1, 2, 3, 4, 5]
// Star under the mouse pointer, previewing the rating before clicking.
const hovered = ref(0)

const shown = computed(() => hovered.value || props.rating)
const readonlyLabel = computed(() => `${props.rating} out of 5 stars`)
</script>

<template>
  <span v-if="readonly" class="stars" role="img" :aria-label="readonlyLabel">
    <span
      v-for="star in stars"
      :key="star"
      class="star"
      :class="{ filled: star <= Math.round(rating) }"
      aria-hidden="true"
      >★</span
    >
  </span>

  <div v-else class="stars" role="radiogroup" aria-label="Star rating" @mouseleave="hovered = 0">
    <template v-for="star in stars" :key="star">
      <input
        :id="`${name}-${star}`"
        class="visually-hidden star-input"
        type="radio"
        :name="name"
        :value="star"
        :checked="rating === star"
        :data-testid="`star-${star}`"
        @change="emit('select', star)"
      />
      <label
        :for="`${name}-${star}`"
        class="star star-option"
        :class="{ filled: star <= shown }"
        @mouseenter="hovered = star"
      >
        <span aria-hidden="true">★</span>
        <span class="visually-hidden">{{ star }} star{{ star === 1 ? '' : 's' }}</span>
      </label>
    </template>
  </div>
</template>

<style scoped>
.stars {
  display: inline-flex;
  gap: 2px;
  line-height: 1;
}
.star {
  color: var(--color-line);
}
.star.filled {
  color: var(--color-accent);
}
.star-option {
  font-size: 30px;
  padding: 2px;
  cursor: pointer;
  transition: transform 150ms;
}
.star-option:hover {
  transform: scale(1.12);
}
.star-input:focus-visible + .star-option {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 4px;
}
@media (prefers-reduced-motion: reduce) {
  .star-option {
    transition: none;
  }
}
</style>
