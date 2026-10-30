<script setup>
import { RouterLink } from 'vue-router'

// Round + button fixed to the bottom-right corner while browsing or managing listings.
</script>

<template>
  <RouterLink to="/listing-form" class="post-fab" aria-label="Post food" data-testid="post-fab">
    <span class="post-fab-icon" aria-hidden="true">+</span>
    <span class="post-fab-label" aria-hidden="true">Post food</span>
  </RouterLink>
</template>

<style scoped>
.post-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 25;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: #fff;
  text-decoration: none;
  box-shadow: 0 10px 24px #ad453245;
  transition:
    transform 200ms,
    background-color 200ms;
}
.post-fab:hover {
  background: #873325;
  color: #fff;
  transform: translateY(-3px);
}
.post-fab:focus-visible {
  outline: 3px solid var(--color-ink);
  outline-offset: 3px;
}
.post-fab-icon {
  font-size: 32px;
  line-height: 1;
  transition: transform 250ms;
}
.post-fab:hover .post-fab-icon {
  transform: rotate(90deg);
}
/* Small label that slides out to the left on hover or keyboard focus. */
.post-fab-label {
  position: absolute;
  right: 72px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--color-ink);
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  transform: translateX(6px);
  transition:
    opacity 200ms,
    transform 200ms;
  pointer-events: none;
}
.post-fab:hover .post-fab-label,
.post-fab:focus-visible .post-fab-label {
  opacity: 1;
  transform: none;
}
@media (max-width: 575px) {
  .post-fab {
    right: 16px;
    bottom: 16px;
    width: 56px;
    height: 56px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .post-fab,
  .post-fab-icon,
  .post-fab-label {
    transition: none;
  }
  .post-fab:hover,
  .post-fab:hover .post-fab-icon {
    transform: none;
  }
}
</style>
