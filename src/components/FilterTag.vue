<script setup>
// A removable chip for one active filter, e.g. "Halal ✕".
// The parent passes in the text to show and decides what removing it means.

defineProps({
  label: String,
})


const emit = defineEmits(['remove'])
</script>

<template>
  <button
    type="button"
    @click="emit('remove')"
    class="filter-tag btn btn-sm"
    :aria-label="`Remove filter: ${label}`"
  >
    {{ label }}
    <span class="ms-1" aria-hidden="true">✕</span>
  </button>
</template>

<style scoped>
.filter-tag {
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink);
}

.filter-tag:hover,
.filter-tag:focus-visible {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
</style>
