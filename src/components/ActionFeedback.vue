<script setup>
import { nextTick, ref, watch } from 'vue'
import FoodLoader from '@/components/FoodLoader.vue'
import { useActionFeedback } from '@/composables/useActionFeedback'

const { feedback } = useActionFeedback()
const panel = ref(null)
let previousFocus = null

watch(
  () => feedback.active,
  async (active) => {
    if (active) {
      previousFocus = document.activeElement
      await nextTick()
      panel.value?.focus({ preventScroll: true })
    } else {
      await nextTick()
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  },
)
</script>

<template>
  <div v-if="feedback.active" class="action-backdrop">
    <section
      ref="panel"
      class="action-feedback"
      role="dialog"
      aria-modal="true"
      :aria-label="feedback.label"
      tabindex="-1"
      data-testid="action-feedback"
    >
      <FoodLoader :label="feedback.label" />
    </section>
  </div>
</template>

<style scoped>
.action-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 16px;
  background: #f8f4edd9;
  backdrop-filter: blur(5px);
}
.action-feedback {
  width: min(360px, 100%);
  max-height: calc(100dvh - 32px);
  overflow: auto;
  border: 1px solid var(--color-line);
  border-radius: 24px;
  background: var(--color-paper);
  box-shadow: 0 18px 60px #332a201a;
  outline: none;
}
</style>
