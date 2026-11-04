<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import NavBar from '@/components/NavBar.vue'
import BrandLogo from '@/components/BrandLogo.vue'
import HomeFoodScene from '@/components/HomeFoodScene.vue'
import PostFoodButton from '@/components/PostFoodButton.vue'
import ListingCard from '@/components/listings/ListingCard.vue'
import FilterBar from '@/components/FilterBar.vue'
import { displayStatus, getAvailableListings, photoUrl } from '@/utils/listings'
import { withRemainingPortions } from '@/utils/reservations'
import { distanceKm, listingCoords } from '@/utils/map'
import { useLandingMotion } from '@/composables/useLandingMotion'
import { useHomeNavigation } from '@/composables/useHomeNavigation'
import { vReveal } from '@/utils/reveal'
import { useFiltersStore } from '@/stores/filters'

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

// Shared with the map page, so filters chosen here still apply there.
const filters = useFiltersStore()

const listings = ref([])
const loading = ref(true)
const error = ref('')
const now = ref(new Date())
let timer

// The user's position, requested from the browser only when "Nearest to me" is chosen.
const userLocation = ref(null)
const locating = ref(false)
const locationError = ref('')

const foodTypes = [
  { value: 'all', label: 'All food' },
  { value: 'free', label: 'Free buffet' },
  { value: 'discounted', label: 'Reservation food' },
]
const availableListings = computed(() =>
  listings.value.filter((listing) => displayStatus(listing, now.value) === 'open'),
)
const visibleListings = computed(() => {
  const results = availableListings.value.filter((listing) =>
    filters.matchesFunction(listing, now.value),
  )
  if (filters.sortBy === 'ending') {
    results.sort((a, b) => new Date(a.pickup_end) - new Date(b.pickup_end))
  } else if (filters.sortBy === 'nearest' && userLocation.value) {
    // Listings without map coordinates go last.
    results.sort((a, b) => (cardDistance(a) ?? Infinity) - (cardDistance(b) ?? Infinity))
  }
  return results
})

// Distance in km from the user, or null when either location is unknown.
// Only shown on cards while sorting by nearest.
function cardDistance(listing) {
  const coords = listingCoords(listing)
  if (filters.sortBy !== 'nearest' || !userLocation.value || !coords) return null
  return distanceKm(userLocation.value, coords)
}

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 5 * 60 * 1000,
    })
  })
}

const BLOCKED_MESSAGE =
  'Location is blocked for this site. Click the icon left of the address bar, set Location to Allow, then choose "Nearest to me" again.'

// Asks the Permissions API whether location was already blocked; older browsers without it
// fall through to the normal request.
async function isLocationBlocked() {
  try {
    const permission = await navigator.permissions?.query({ name: 'geolocation' })
    return permission?.state === 'denied'
  } catch {
    return false
  }
}

async function locateUser() {
  locationError.value = ''
  if (!('geolocation' in navigator)) {
    locationError.value = 'Your browser cannot share its location, so listings stay newest first.'
    filters.sortBy = 'newest'
    return
  }
  // Browsers only allow location on HTTPS or localhost, and never show the popup there.
  if (!window.isSecureContext) {
    locationError.value =
      'Location needs a secure (https://) connection. Open LastBite over HTTPS to sort by distance.'
    filters.sortBy = 'newest'
    return
  }
  // Once location is blocked for this site, the browser will not ask again,
  // so explain how to turn it back on instead of failing silently.
  if (await isLocationBlocked()) {
    locationError.value = BLOCKED_MESSAGE
    filters.sortBy = 'newest'
    return
  }
  // This call shows the browser's "Allow location?" popup when the user has not decided yet.
  locating.value = true
  try {
    const position = await getBrowserLocation()
    userLocation.value = { lat: position.coords.latitude, lng: position.coords.longitude }
  } catch (err) {
    // err.code 1 means the user (or browser settings) blocked location access.
    locationError.value =
      err.code === 1 ? BLOCKED_MESSAGE : 'Could not find your location. Please try again.'
    filters.sortBy = 'newest'
  } finally {
    locating.value = false
  }
}

// The warning is not cleared here: a failed lookup switches back to "newest",
// which would otherwise hide the message straight away.
// `immediate` because the store keeps "Nearest to me" when the user comes back to this page,
// but the location found last time was lost when the page closed.
watch(
  () => filters.sortBy,
  (value) => {
    if (value === 'nearest' && !userLocation.value) locateUser()
  },
  { immediate: true },
)

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
            v-model="filters.query"
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
            :aria-pressed="filters.foodType === type.value"
            :class="filters.foodType === type.value ? 'btn-success' : 'text-secondary'"
            @click="filters.foodType = type.value"
          >
            {{ type.label }}
          </button>
        </div>
        <div class="d-flex flex-wrap align-items-center gap-2">
          <router-link
            :to="{ name: 'listings-map' }"
            class="btn btn-sm btn-outline-success text-nowrap"
            data-testid="open-map"
          >
            <span aria-hidden="true">📍</span> View on map
          </router-link>
          <label for="food-sort" class="small text-secondary text-nowrap">Sort by</label>
          <span
            v-if="locating"
            class="spinner-border spinner-border-sm text-success"
            role="status"
            aria-label="Finding your location"
          ></span>
          <select
            id="food-sort"
            v-model="filters.sortBy"
            class="form-select form-select-sm w-auto"
            :disabled="locating"
          >
            <option value="newest">Newest first</option>
            <option value="ending">Pickup ending soon</option>
            <option value="nearest">Nearest to me</option>
          </select>
        </div>
      </div>
      <FilterBar />
      <div
        v-if="locationError"
        class="alert alert-warning d-flex justify-content-between align-items-start gap-2 py-2 small"
        role="alert"
        data-testid="location-error"
      >
        <span>{{ locationError }}</span>
        <button
          type="button"
          class="btn-close btn-sm"
          aria-label="Dismiss location message"
          @click="locationError = ''"
        ></button>
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
          @click="filters.clearAllFunction()"
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
            :distance-km="cardDistance(listing)"
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
