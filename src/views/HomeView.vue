<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import NavBar from '@/components/NavBar.vue'
import BrandLogo from '@/components/BrandLogo.vue'
import HomeFoodScene from '@/components/HomeFoodScene.vue'
import PostFoodButton from '@/components/PostFoodButton.vue'
import ListingCard from '@/components/listings/ListingCard.vue'
import { displayStatus, getAvailableListings, photoUrl } from '@/utils/listings'
import { withRemainingPortions } from '@/utils/reservations'
import { useLandingMotion } from '@/composables/useLandingMotion'
import { useHomeNavigation } from '@/composables/useHomeNavigation'
import { vReveal } from '@/utils/reveal'

const logo = ref(null)
const navbar = ref(null)
const foodScene = ref(null)
const { homeHref, goHome, homeEntrance } = useHomeNavigation()
const { active, navOpacity, logoStyle, foodStyle } = useLandingMotion(logo, navbar)

// Replay the entrance without rebuilding the WebGL scene.
watch(homeEntrance, () => {
  for (const animation of foodScene.value.getAnimations()) {
    animation.currentTime = 0
    animation.play()
  }
})

const listings = ref([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const foodType = ref('all')
const sortBy = ref('newest')
const now = ref(new Date())
let timer

const foodTypes = [
  { value: 'all', label: 'All food' },
  { value: 'free', label: 'Free buffet' },
  { value: 'discounted', label: 'Reservation food' },
]
const availableListings = computed(() =>
  listings.value.filter((listing) => displayStatus(listing, now.value) === 'open'),
)
const visibleListings = computed(() => {
  const search = query.value.trim().toLowerCase()
  const results = availableListings.value.filter((listing) => {
    const matchesType = foodType.value === 'all' || listing.listing_type === foodType.value
    const details = `${listing.title} ${listing.address} ${listing.description || ''}`.toLowerCase()
    return matchesType && details.includes(search)
  })
  if (sortBy.value === 'ending') {
    results.sort((a, b) => new Date(a.pickup_end) - new Date(b.pickup_end))
  }
  return results
})

function clearFilters() {
  query.value = ''
  foodType.value = 'all'
}

async function loadListings() {
  loading.value = true
  error.value = ''
  try {
    listings.value = await withRemainingPortions(await getAvailableListings())
    now.value = new Date()
  } catch (err) {
    error.value = `Could not load listings: ${err.message}`
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadListings()
  timer = setInterval(() => {
    now.value = new Date()
  }, 30_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <main class="home-page">
    <NavBar ref="navbar" :brand-opacity="navOpacity" />
    <header class="home-hero container">
      <div class="hero-brand">
        <h1 ref="logo" class="mb-0" :class="{ 'logo-in-flight': active }">
          <a :href="homeHref" class="hero-logo-link" aria-label="Last Bite home" @click="goHome">
            <BrandLogo />
          </a>
        </h1>
        <div :key="homeEntrance" class="hero-actions page-enter">
          <router-link to="/#browse" class="btn btn-success"
            >Browse food <span aria-hidden="true">↓</span></router-link
          >
          <router-link to="/listing-form" class="hero-post"
            >Post food <span aria-hidden="true">↗</span></router-link
          >
        </div>
      </div>
      <div ref="foodScene" class="hero-food page-enter" :style="foodStyle">
        <HomeFoodScene />
      </div>
    </header>
    <div v-if="active" class="logo-flight" :style="logoStyle" aria-hidden="true">
      <span :key="homeEntrance" class="logo-arrival page-enter"><BrandLogo /></span>
    </div>
    <section id="browse" class="container browse-section" :aria-busy="loading">
      <div
        class="browse-heading d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3"
      >
        <div>
          <h2 class="mb-0">Browse food</h2>
          <p v-if="!loading && !error" class="small text-secondary mt-2 mb-0" role="status">
            {{ visibleListings.length }} listing{{ visibleListings.length === 1 ? '' : 's' }}
          </p>
        </div>
        <div class="browse-search">
          <label for="food-search" class="visually-hidden">Search food or pickup location</label>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10" cy="10" r="6" />
            <path d="m15 15 5 5" />
          </svg>
          <input
            id="food-search"
            v-model="query"
            type="search"
            class="form-control"
            placeholder="Search food or pickup location"
          />
        </div>
      </div>
      <div
        class="browse-controls d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"
      >
        <div class="food-types d-flex p-1 border rounded-3" role="group" aria-label="Food type">
          <button
            v-for="type in foodTypes"
            :key="type.value"
            type="button"
            class="btn btn-sm flex-fill text-nowrap"
            :aria-pressed="foodType === type.value"
            :class="foodType === type.value ? 'btn-success' : 'text-secondary'"
            @click="foodType = type.value"
          >
            {{ type.label }}
          </button>
        </div>
        <div class="d-flex align-items-center gap-2">
          <label for="food-sort" class="small text-secondary text-nowrap">Sort by</label>
          <select id="food-sort" v-model="sortBy" class="form-select form-select-sm">
            <option value="newest">Newest first</option>
            <option value="ending">Pickup ending soon</option>
          </select>
        </div>
      </div>
      <div v-if="!loading && error" class="alert alert-danger" role="alert">
        {{ error }}
        <button type="button" class="btn btn-sm btn-outline-danger ms-2" @click="loadListings">
          Try again
        </button>
      </div>
      <div v-else-if="!loading && !visibleListings.length" class="browse-empty">
        <svg class="empty-plate" viewBox="0 0 80 80" aria-hidden="true">
          <circle
            cx="40"
            cy="40"
            r="30"
            fill="var(--color-paper)"
            stroke="var(--color-line)"
            stroke-width="2"
          />
          <circle cx="40" cy="40" r="21" fill="none" stroke="var(--color-line)" stroke-width="2" />
          <path
            d="M39 51C24 47 28 29 49 28c3 14-1 24-10 23Zm-4-2 9-14"
            fill="#e1eedd"
            stroke="#597d50"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <h3 class="h4 page-title mb-3">
          {{ availableListings.length ? 'No matching food' : 'No food available right now' }}
        </h3>
        <button
          v-if="availableListings.length"
          type="button"
          class="btn btn-outline-success btn-sm"
          @click="clearFilters"
        >
          Clear filters
        </button>
        <router-link v-else to="/listing-form" class="btn btn-outline-success btn-sm"
          >Post food</router-link
        >
      </div>
      <div v-else-if="!loading" class="row g-4">
        <div v-for="listing in visibleListings" :key="listing.id" class="col-sm-6 col-lg-4">
          <ListingCard
            v-reveal="'lift'"
            :listing="listing"
            :now="now"
            :photo-src="photoUrl(listing.photo_path)"
            :to="{ name: 'listing-detail', params: { id: listing.id } }"
          />
        </div>
      </div>
    </section>
    <PostFoodButton />
  </main>
</template>

<style scoped>
.hero-logo-link {
  display: inline-flex;
  color: inherit;
  text-decoration: none;
}
.hero-logo-link:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 6px;
  border-radius: 8px;
}
.logo-arrival {
  display: flex;
}
.home-hero {
  overflow: clip;
  border-bottom: 1px solid var(--color-line);
  margin-bottom: 32px;
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
  font-size: inherit;
  letter-spacing: inherit;
  gap: var(--logo-gap);
}
.logo-flight :deep(svg) {
  width: var(--logo-icon-size);
  height: var(--logo-icon-size);
}
.hero-food {
  max-width: 420px;
  will-change: transform;
}
@media (max-width: 767px) {
  .hero-food {
    width: 280px;
  }
}
.browse-search {
  position: relative;
  width: min(100%, 360px);
}
.browse-search svg {
  position: absolute;
  top: 15px;
  left: 16px;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: var(--color-muted);
  stroke-width: 1.8;
  pointer-events: none;
}
.browse-search input {
  padding-left: 44px;
  background: var(--color-paper);
  font-size: 14px;
}
.browse-controls {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-line);
}
.food-types {
  background: var(--color-paper);
}
.food-types button:focus-visible {
  outline: 2px solid var(--color-ink);
  outline-offset: 2px;
}
.browse-empty {
  padding: 40px 20px;
  border: 1px dashed var(--color-line);
  border-radius: 20px;
  background: #fffdf970;
  text-align: center;
}
.empty-plate {
  width: 80px;
  height: 80px;
  margin-bottom: 12px;
}
@media (max-width: 575px) {
  .browse-search,
  .food-types {
    width: 100%;
  }
}
.hero-actions {
  animation-delay: 150ms;
}
.hero-food {
  animation-delay: 300ms;
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
}
</style>
