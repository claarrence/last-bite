<script setup>
import { ref } from 'vue'

const props = defineProps({ interactive: { type: Boolean, default: false } })
const tilt = ref({ x: 0, y: 0 })

// A small pointer effect only on login; touch and reduced-motion users get the static layout.
function moveScene(event) {
  if (
    !props.interactive ||
    event.pointerType !== 'mouse' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return
  const bounds = event.currentTarget.getBoundingClientRect()
  tilt.value = {
    x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 12,
    y: ((event.clientY - bounds.top) / bounds.height - 0.5) * -12,
  }
}
</script>

<template>
  <div
    class="food-scene"
    :class="{ 'scene-interactive': interactive }"
    aria-hidden="true"
    :style="{ '--tilt-x': `${tilt.x}deg`, '--tilt-y': `${tilt.y}deg` }"
    @pointermove="moveScene"
    @pointerleave="tilt = { x: 0, y: 0 }"
  >
    <div class="scene-content">
      <div class="scene-disc"></div>
      <div class="scene-orbit"></div>
      <div v-if="interactive" class="scene-inner-orbit"></div>
      <img class="scene-photo scene-main" src="/images/salad.jpg" alt="" />
      <template v-if="interactive">
        <div class="satellite-track">
          <img class="scene-photo satellite-photo" src="/images/meal.jpg" alt="" />
        </div>
        <div class="satellite-track track-second">
          <img class="scene-photo satellite-photo" src="/images/buffet.jpg" alt="" />
        </div>
        <span class="scene-dot dot-first"></span><span class="scene-dot dot-second"></span>
      </template>
      <template v-else>
        <img class="scene-photo scene-small" src="/images/meal.jpg" alt="" />
        <img class="scene-photo scene-bottom" src="/images/buffet.jpg" alt="" />
      </template>
      <svg class="scene-spark" viewBox="0 0 40 40">
        <path d="M20 0 24 16 40 20 24 24 20 40 16 24 0 20 16 16Z" fill="currentColor" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
/* The login variation adds real orbital movement. Its small plates counter-rotate so photos stay upright. */
.food-scene {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  isolation: isolate;
}
.scene-content {
  position: absolute;
  inset: 0;
}
.scene-disc {
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  background: var(--color-peach);
}
.scene-orbit {
  position: absolute;
  inset: 1%;
  border: 1px dashed #35302b40;
  border-radius: 50%;
  animation: orbit 45s linear infinite;
}
.scene-orbit::after {
  content: '';
  position: absolute;
  top: 14%;
  left: 14%;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--color-accent);
}
.scene-photo {
  position: absolute;
  object-fit: cover;
  border: 7px solid var(--color-paper);
  border-radius: 50%;
  box-shadow: 0 18px 32px #3b261c20;
  transition: scale 500ms ease;
}
.scene-main {
  width: 66%;
  height: 66%;
  left: 22%;
  top: 17%;
  animation: plate-float 7s ease-in-out infinite;
}
.scene-small {
  width: 32%;
  height: 32%;
  left: 0;
  top: 5%;
  animation: plate-float 9s ease-in-out -3s infinite reverse;
}
.scene-bottom {
  width: 31%;
  height: 31%;
  right: 0;
  bottom: 0;
  animation: plate-float 8s ease-in-out -5s infinite;
}
.scene-spark {
  position: absolute;
  width: 34px;
  height: 34px;
  left: 10%;
  bottom: 16%;
  color: var(--color-accent);
  animation: spark-turn 12s ease-in-out infinite;
}
.scene-interactive {
  perspective: 900px;
}
.scene-interactive .scene-content {
  transform: rotateX(var(--tilt-y)) rotateY(var(--tilt-x));
  transition: transform 350ms ease-out;
}
.scene-interactive .scene-disc {
  inset: 13%;
  animation: disc-breathe 7s ease-in-out infinite;
}
.scene-interactive .scene-main {
  width: 59%;
  height: 59%;
  top: 21%;
  left: 21%;
  z-index: 2;
  animation-duration: 5s;
}
.scene-interactive .scene-orbit {
  inset: 4%;
  animation-duration: 26s;
}
.scene-inner-orbit {
  position: absolute;
  inset: 13%;
  border: 1px solid #ad453255;
  border-radius: 50%;
  animation: orbit 18s linear infinite reverse;
}
.scene-inner-orbit::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  top: 14%;
  right: 14%;
}
.satellite-track {
  position: absolute;
  inset: 8%;
  z-index: 3;
  pointer-events: none;
  animation: orbit 26s linear infinite;
}
.satellite-photo {
  width: 29%;
  height: 29%;
  left: -8%;
  top: 7%;
  animation: orbit 26s linear infinite reverse;
}
.track-second {
  animation-duration: 32s;
  animation-direction: reverse;
}
.track-second .satellite-photo {
  top: auto;
  left: auto;
  bottom: 7%;
  right: -8%;
  animation-duration: 32s;
  animation-direction: normal;
}
.scene-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
}
.dot-first {
  right: 18%;
  top: 5%;
}
.dot-second {
  left: 17%;
  bottom: 6%;
  background: var(--color-paper);
}
.scene-interactive .scene-spark {
  left: 6%;
  bottom: 21%;
}
@keyframes disc-breathe {
  0%,
  100% {
    scale: 1;
  }
  50% {
    scale: 1.06;
  }
}
@media (hover: hover) {
  .food-scene:hover .scene-main {
    scale: 1.04;
  }
}
@keyframes plate-float {
  0%,
  100% {
    translate: 0 0;
    rotate: -3deg;
  }
  50% {
    translate: 0 -14px;
    rotate: 3deg;
  }
}
@keyframes orbit {
  to {
    transform: rotate(360deg);
  }
}
@keyframes spark-turn {
  0%,
  100% {
    rotate: 0deg;
    scale: 1;
  }
  50% {
    rotate: 90deg;
    scale: 0.8;
  }
}
@media (max-width: 575px) {
  .scene-photo {
    border-width: 5px;
  }
  .scene-spark {
    width: 24px;
    height: 24px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .scene-orbit,
  .scene-photo,
  .scene-spark,
  .scene-inner-orbit,
  .satellite-track,
  .scene-interactive .scene-disc {
    animation: none;
    transition: none;
  }
  .scene-interactive .scene-content {
    transform: none;
    transition: none;
  }
}
</style>
