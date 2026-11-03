<script setup>
defineProps({
  label: { type: String, default: 'Finding available food…' },
})
</script>

<template>
  <div class="food-loader" role="status" aria-live="polite" aria-atomic="true">
    <svg class="loader-scene" viewBox="0 0 240 160" aria-hidden="true" focusable="false">
      <ellipse class="plate-shadow" cx="120" cy="130" rx="57" ry="7" fill="#282520" opacity=".08" />
      <circle cx="120" cy="79" r="64" fill="var(--color-peach)" opacity=".16" />

      <g
        class="loader-steam"
        fill="none"
        stroke="var(--color-muted)"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path class="steam steam-first" d="M103 55c-10-10 8-13 0-23" />
        <path class="steam steam-second" d="M120 49c-10-10 8-13 0-23" />
        <path class="steam steam-third" d="M137 55c-10-10 8-13 0-23" />
      </g>

      <g class="loader-plate">
        <path d="M56 107c5 18 25 27 64 27s59-9 64-27" fill="#e9daca" />
        <ellipse
          cx="120"
          cy="104"
          rx="66"
          ry="23"
          fill="var(--color-paper)"
          stroke="#d8c7b6"
          stroke-width="2"
        />
        <ellipse cx="120" cy="104" rx="48" ry="15" fill="#f5eadc" stroke="#e8d7c5" />
        <path
          d="M72 112c9 6 27 10 48 10"
          fill="none"
          stroke="#fffdf9"
          stroke-width="3"
          stroke-linecap="round"
        />
      </g>

      <!-- Separate SVG groups let each ingredient land at a different beat. -->
      <g class="ingredient ingredient-leaf">
        <path d="M93 104C66 106 65 80 79 74c21-8 34 8 14 30Z" fill="#597d50" />
        <path
          d="m78 86 15 18m-9-11 1-10m4 15-10-1"
          fill="none"
          stroke="#c2d3a3"
          stroke-width="2"
          stroke-linecap="round"
        />
      </g>
      <g class="ingredient ingredient-dumpling">
        <path
          d="M105 101c0-14 10-28 23-28 14 0 24 14 24 28-10 11-36 11-47 0Z"
          fill="#e5b561"
          stroke="#c49449"
          stroke-width="1.5"
        />
        <path
          d="m117 82 3 17m8-20v20m10-17-3 17"
          fill="none"
          stroke="#f9d994"
          stroke-width="2.5"
          stroke-linecap="round"
        />
      </g>
      <g class="ingredient ingredient-tomato">
        <circle cx="102" cy="104" r="13" fill="var(--color-accent)" />
        <path d="m102 88 1 7 6-3-4 5 4 3-7-1-4 4 1-7-5-2 7-1Z" fill="#597d50" />
        <path
          d="M95 102c0-3 1-5 3-6"
          fill="none"
          stroke="#e9b49d"
          stroke-width="2.5"
          stroke-linecap="round"
        />
      </g>

      <g
        class="loader-spark spark-left"
        stroke="var(--color-accent)"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="m53 72 4 4m-13 6 6 1" />
      </g>
      <g class="loader-spark spark-right" stroke="#597d50" stroke-width="2" stroke-linecap="round">
        <path d="m185 66-4 5m14 6-6 1" />
      </g>
    </svg>
    <p class="loader-label">{{ label }}</p>
    <span class="loader-crumbs" aria-hidden="true"><i></i><i></i><i></i></span>
  </div>
</template>

<style scoped>
.food-loader {
  display: flex;
  min-height: 290px;
  padding: 28px 16px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.loader-scene {
  display: block;
  width: 220px;
  max-width: 100%;
  overflow: visible;
}
.loader-label {
  margin: 4px 0 14px;
  color: var(--color-muted);
  font-size: 14px;
}
.loader-crumbs {
  display: flex;
  gap: 7px;
}
.loader-crumbs i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: crumb-bounce 1.2s ease-in-out infinite;
}
.loader-crumbs i:nth-child(2) {
  animation-delay: 150ms;
  background: #d2a35d;
}
.loader-crumbs i:nth-child(3) {
  animation-delay: 300ms;
  background: #597d50;
}
.loader-plate {
  transform-origin: 120px 108px;
  animation: plate-rock 2.8s ease-in-out infinite;
}
.plate-shadow {
  transform-origin: center;
  transform-box: fill-box;
  animation: shadow-breathe 2.8s ease-in-out infinite;
}
.ingredient {
  transform-box: fill-box;
  transform-origin: center bottom;
  animation: ingredient-drop 2.8s infinite;
}
.ingredient-leaf {
  --turn: -28deg;
}
.ingredient-dumpling {
  --turn: 20deg;
  animation-delay: 180ms;
}
.ingredient-tomato {
  --turn: -16deg;
  animation-delay: 360ms;
}
.steam {
  animation: steam-rise 2.8s ease-in-out infinite;
}
.steam-second {
  animation-delay: 300ms;
}
.steam-third {
  animation-delay: 600ms;
}
.loader-spark {
  transform-box: fill-box;
  transform-origin: center;
  animation: spark-pop 2.8s ease-in-out infinite;
}
.spark-right {
  animation-delay: 360ms;
}
@keyframes ingredient-drop {
  0%,
  8% {
    opacity: 0;
    transform: translateY(-38px) rotate(var(--turn)) scale(0.8);
  }
  28% {
    opacity: 1;
    transform: translateY(3px) rotate(0deg) scale(1.06, 0.92);
  }
  39% {
    transform: translateY(-6px) scale(0.98, 1.04);
  }
  50%,
  78% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  92%,
  100% {
    opacity: 0;
    transform: translateY(-12px) rotate(8deg) scale(0.9);
  }
}
@keyframes plate-rock {
  0%,
  18%,
  65%,
  100% {
    transform: rotate(0deg);
  }
  30% {
    transform: rotate(-3deg) translateY(2px);
  }
  44% {
    transform: rotate(3deg);
  }
  55% {
    transform: rotate(-1deg);
  }
}
@keyframes shadow-breathe {
  0%,
  65%,
  100% {
    transform: scaleX(1);
    opacity: 0.08;
  }
  35% {
    transform: scaleX(0.88);
    opacity: 0.12;
  }
}
@keyframes steam-rise {
  0%,
  15% {
    opacity: 0;
    transform: translateY(6px);
  }
  40% {
    opacity: 0.5;
  }
  85%,
  100% {
    opacity: 0;
    transform: translateY(-14px);
  }
}
@keyframes spark-pop {
  0%,
  19%,
  65%,
  100% {
    opacity: 0;
    transform: scale(0.6);
  }
  32%,
  45% {
    opacity: 0.7;
    transform: scale(1);
  }
}
@keyframes crumb-bounce {
  0%,
  70%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  35% {
    transform: translateY(-5px);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .food-loader *,
  .food-loader .loader-crumbs i {
    animation: none;
  }
  .loader-spark {
    opacity: 0;
  }
  .steam {
    opacity: 0.4;
  }
}
</style>
