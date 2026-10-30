<script setup>
import { ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import BrandLogo from '@/components/BrandLogo.vue'
import FoodVisual from '@/components/FoodVisual.vue'
import PostFoodButton from '@/components/PostFoodButton.vue'
import { useLandingMotion } from '@/composables/useLandingMotion'
import { vReveal } from '@/utils/reveal'

const logo = ref(null)
const navbar = ref(null)
const { active, navOpacity, logoStyle, foodStyle } = useLandingMotion(logo, navbar)

// Placeholder cards hold the food grid's space until the listings feature is added.
const placeholderCards = [1, 2, 3]
</script>

<template>
  <main class="home-page">
    <NavBar ref="navbar" class="home-nav" :brand-opacity="navOpacity" />
    <header class="home-hero container">
      <div class="hero-brand">
        <h1 ref="logo" class="mb-0" :class="{ 'logo-in-flight': active }">
          <BrandLogo />
        </h1>
        <div class="hero-actions">
          <router-link to="/#browse" class="btn btn-success"
            >Browse food <span aria-hidden="true">↓</span></router-link
          >
          <router-link to="/listing-form" class="hero-post"
            >Post food <span aria-hidden="true">↗</span></router-link
          >
        </div>
      </div>
      <div class="hero-food" :style="foodStyle"><FoodVisual /></div>
    </header>
    <div v-if="active" class="logo-flight" :style="logoStyle" aria-hidden="true">
      <BrandLogo />
    </div>
    <section id="browse" class="container browse-section">
      <div class="browse-heading mb-4"><h2>Browse food</h2></div>
      <div class="row g-4" aria-hidden="true">
        <div v-for="card in placeholderCards" :key="card" class="col-sm-6 col-lg-4">
          <div v-reveal="'lift'" class="listing-card placeholder-card">
            <div class="ratio ratio-4x3 shimmer"></div>
            <div class="card-body">
              <div class="shimmer shimmer-line w-75"></div>
              <div class="shimmer shimmer-line w-50"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <PostFoodButton />
  </main>
</template>

<style scoped>
.home-nav :deep(.brand-logo) {
  font-family: Georgia, serif;
  font-weight: 400;
  letter-spacing: -0.6px;
  line-height: 1.2;
}
.hero-brand :deep(.brand-logo) {
  line-height: 1.2;
}
.home-hero {
  overflow: clip;
}
.logo-in-flight :deep(.brand-logo) {
  visibility: hidden;
}
.logo-flight {
  display: flex;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 40;
  pointer-events: none;
  will-change: transform;
}
.logo-flight :deep(.brand-logo) {
  font-family: Georgia, serif;
  font-size: inherit;
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: inherit;
  gap: var(--logo-gap);
}
.logo-flight :deep(svg) {
  width: var(--logo-icon-size);
  height: var(--logo-icon-size);
}
.hero-food {
  width: 100%;
  will-change: transform;
}
/* Entrance on page load. `translate` is used so it never fights the scroll `transform`. */
.hero-actions,
.hero-food {
  animation: hero-rise 800ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.hero-actions {
  animation-delay: 150ms;
}
.hero-food {
  animation-delay: 300ms;
}
@keyframes hero-rise {
  from {
    opacity: 0;
    translate: 0 24px;
  }
}
.shimmer {
  border-radius: 10px;
  background: linear-gradient(100deg, #efe8de 30%, #f8f3ec 50%, #efe8de 70%) 0 0 / 300% 100%;
  animation: shimmer 1.6s linear infinite;
}
.placeholder-card .ratio {
  border-radius: 0;
}
.shimmer-line {
  height: 14px;
  margin-bottom: 12px;
}
@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: 0 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .logo-flight {
    display: none;
  }
  .logo-in-flight :deep(.brand-logo) {
    visibility: visible;
  }
  .hero-food {
    transform: none !important;
  }
  .hero-actions,
  .hero-food,
  .shimmer {
    animation: none;
  }
}
</style>
