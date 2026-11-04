<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import NavBar from '@/components/NavBar.vue'
import FilterBar from '@/components/FilterBar.vue'
import { getAvailableListings } from '@/utils/listings'
import { formatPickupWindow, formatPrice } from '@/utils/format'
import { useFiltersStore } from '@/stores/filters'
import {
  createOneMap,
  discountedPinIcon,
  distanceKm,
  formatDistance,
  getBrowserPosition,
  listingCoords,
  pinIcon,
} from '@/utils/map'

const router = useRouter()

const listings = ref([])
const loading = ref(true)
const error = ref('')
const radiusKm = ref(0) // 0 = any distance
const mapSort = ref('nearest')
const here = ref(null) // { lat, lng } once the browser shares a location
const locating = ref(false)
const locationError = ref('')
const selectedId = ref(null)
const filters = useFiltersStore()

// Same labels as the Browse food section on the homepage.
const foodTypes = [
  { value: 'all', label: 'All food' },
  { value: 'free', label: 'Free buffet' },
  { value: 'discounted', label: 'Reservation food' },
]
const radii = [
  { value: 1, label: 'Within 1 km' },
  { value: 2, label: 'Within 2 km' },
  { value: 5, label: 'Within 5 km' },
  { value: 0, label: 'Any distance' },
]

const el = ref(null)
let map = null
let listingLayer = null
let hereMarker = null
const markers = new Map() // listing id -> Leaflet marker

async function loadListings() {
  loading.value = true
  error.value = ''
  try {
    listings.value = await getAvailableListings()
  } catch (err) {
    error.value = `Could not load listings: ${err.message}`
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  map = createOneMap(el.value)
  listingLayer = L.layerGroup().addTo(map)
  locate()
  loadListings()
})

// stop() ends a pin's flyTo animation before the map is removed.
onBeforeUnmount(() => {
  map?.stop()
  map?.remove()
})

// Opened directly (no in-app history), there's nothing to go back to, so go home instead.
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push({ name: 'home', hash: '#browse' })
}

// Listings that have map coordinates, with distance from the user when known.
const pinned = computed(() =>
  listings.value
    .map((listing) => {
      const coords = listingCoords(listing)
      return coords && { listing, coords, km: here.value ? distanceKm(here.value, coords) : null }
    })
    .filter(Boolean),
)
const unpinnedCount = computed(() => listings.value.length - pinned.value.length)

// Nearest first once the user's position is known, unless sorted by pickup deadline.
const visible = computed(() => {
  const results = pinned.value
    .filter(({ listing }) => filters.matchesFunction(listing, new Date()))
    .filter(({ km }) => !radiusKm.value || km == null || km <= radiusKm.value)

  if (mapSort.value === 'ending') {
    return results.sort((a, b) => new Date(a.listing.pickup_end) - new Date(b.listing.pickup_end))
  }
  return results.sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
})

async function locate() {
  if (!navigator.geolocation) {
    locationError.value = 'Your browser cannot share its location.'
    return
  }
  locating.value = true
  locationError.value = ''
  try {
    const { coords } = await getBrowserPosition({ enableHighAccuracy: true, timeout: 10000 })
    here.value = { lat: coords.latitude, lng: coords.longitude }
    if (!radiusKm.value) radiusKm.value = 2
  } catch {
    locationError.value = 'Location is off, so listings are not sorted by distance.'
  } finally {
    locating.value = false
  }
}

function priceText(listing) {
  return listing.listing_type === 'discounted' ? `${formatPrice(listing.price)} each` : 'Free'
}

function popupContent({ listing, km }) {
  const box = document.createElement('div')
  const title = document.createElement('strong')
  title.textContent = listing.title
  const meta = document.createElement('div')
  meta.className = 'small text-secondary'
  meta.textContent = [priceText(listing), km != null && formatDistance(km)]
    .filter(Boolean)
    .join(' · ')
  const when = document.createElement('div')
  when.className = 'small'
  when.textContent = formatPickupWindow(listing.pickup_start, listing.pickup_end)
  const link = document.createElement('a')
  link.href = router.resolve({ name: 'listing-detail', params: { id: listing.id } }).href
  link.className = 'small fw-semibold d-inline-block mt-1'
  link.textContent = 'View listing →'
  // Navigate inside the SPA instead of reloading the page.
  link.addEventListener('click', (event) => {
    event.preventDefault()
    router.push({ name: 'listing-detail', params: { id: listing.id } })
  })
  box.append(title, meta, when, link)
  return box
}

function drawListings() {
  if (!map) return
  listingLayer.clearLayers()
  markers.clear()
  for (const item of visible.value) {
    const icon = item.listing.listing_type === 'discounted' ? discountedPinIcon : pinIcon
    const marker = L.marker([item.coords.lat, item.coords.lng], { icon, title: item.listing.title })
      .bindPopup(popupContent(item))
      .on('click', () => focusCard(item.listing.id))
      .addTo(listingLayer)
    markers.set(item.listing.id, marker)
  }
  fitView()
}

function drawHere() {
  if (!map || !here.value) return
  const position = [here.value.lat, here.value.lng]
  if (!hereMarker) {
    hereMarker = L.circleMarker(position, {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: '#1a73e8',
      fillOpacity: 1,
    })
      .bindTooltip('You are here')
      .addTo(map)
  } else {
    hereMarker.setLatLng(position)
  }
}

// Frame the visible pins (plus the user's own position, if known). Not animated: an animated
// zoom still running when the page is left makes Leaflet throw after the map is removed.
function fitView() {
  const points = visible.value.map(({ coords }) => [coords.lat, coords.lng])
  if (here.value) points.push([here.value.lat, here.value.lng])
  if (points.length > 1) {
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 17, animate: false })
  } else if (points.length === 1) {
    map.setView(points[0], 16, { animate: false })
  }
}

async function focusCard(id) {
  selectedId.value = id
  await nextTick()
  document.getElementById(`nearby-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function focusPin(id) {
  selectedId.value = id
  const marker = markers.get(id)
  if (!marker) return
  map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 16), { duration: 0.5 })
  marker.openPopup()
}

watch(visible, drawListings)
watch(here, drawHere)
</script>

<template>
  <NavBar />

  <main class="container py-4 nearby-page">
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
      <div>
        <h1 class="page-title mb-1">Food near you</h1>
        <p class="text-secondary small mb-0">
          <span class="legend-dot bg-free" aria-hidden="true"></span> Free
          <span class="legend-dot bg-discounted ms-2" aria-hidden="true"></span> Discounted
          <span class="legend-dot bg-here ms-2" aria-hidden="true"></span> You
        </p>
      </div>
      <button type="button" class="back-link" @click="goBack">
        <span aria-hidden="true">←</span> Back to list
      </button>
    </div>

    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
      <div class="food-types d-flex p-1 border rounded-3" role="group" aria-label="Food type">
        <button
          v-for="option in foodTypes"
          :key="option.value"
          type="button"
          class="btn btn-sm flex-fill text-nowrap"
          :aria-pressed="filters.foodType === option.value"
          :class="filters.foodType === option.value ? 'btn-success' : 'text-secondary'"
          @click="filters.foodType = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <select
          v-model="mapSort"
          class="form-select form-select-sm w-auto"
          aria-label="Sort map list"
        >
          <option value="nearest">Nearest first</option>
          <option value="ending">Pickup ending soon</option>
        </select>
        <select
          v-model.number="radiusKm"
          class="form-select form-select-sm w-auto distance-select"
          :disabled="!here"
          aria-label="Distance"
        >
          <option v-for="r in radii" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>

        <button
          type="button"
          class="btn btn-sm btn-success text-nowrap"
          :disabled="locating"
          @click="locate"
        >
          <span
            v-if="locating"
            class="spinner-border spinner-border-sm me-1"
            aria-hidden="true"
          ></span>
          {{ here ? 'Update location' : 'Use my location' }}
        </button>
      </div>
    </div>

    <FilterBar />

    <div v-if="locationError" class="alert alert-warning py-2 small" role="status">
      {{ locationError }}
    </div>
    <div v-if="error" class="alert alert-danger py-2 small" role="alert">
      {{ error }}
      <button type="button" class="btn btn-sm btn-outline-danger ms-2" @click="loadListings">
        Try again
      </button>
    </div>

    <div class="row g-3">
      <div class="col-lg-8">
        <div ref="el" class="nearby-map" data-testid="nearby-map"></div>
      </div>

      <aside class="col-lg-4" aria-label="Listings on the map">
        <div class="nearby-list">
          <p v-if="loading" class="text-center text-secondary py-4" role="status">
            Loading food listings…
          </p>
          <template v-else>
            <p class="list-count">
              {{ visible.length }} {{ visible.length === 1 ? 'listing' : 'listings' }} on the map
              <template v-if="unpinnedCount">
                · {{ unpinnedCount }} without a map location</template
              >
            </p>
            <div v-if="!visible.length" class="text-center py-4">
              <p class="mb-2">
                No food {{ here && radiusKm ? `within ${radiusKm} km` : 'on the map' }} right now.
              </p>
              <button
                v-if="here && radiusKm"
                type="button"
                class="btn btn-sm btn-outline-success"
                @click="radiusKm = 0"
              >
                Show any distance
              </button>
            </div>
            <div class="nearby-items">
              <button
                v-for="{ listing, km } in visible"
                :id="`nearby-${listing.id}`"
                :key="listing.id"
                type="button"
                class="nearby-item"
                :class="{ selected: selectedId === listing.id }"
                :aria-current="selectedId === listing.id"
                data-testid="map-list-item"
                @click="focusPin(listing.id)"
              >
                <span class="d-flex justify-content-between gap-2">
                  <strong class="text-break">{{ listing.title }}</strong>
                  <span v-if="km != null" class="small text-nowrap">{{ formatDistance(km) }}</span>
                </span>
                <span class="d-block small">
                  {{ priceText(listing) }}
                  · {{ formatPickupWindow(listing.pickup_start, listing.pickup_end) }}
                </span>
                <span class="d-block small text-secondary text-truncate">{{
                  listing.address
                }}</span>
              </button>
            </div>
          </template>
        </div>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.back-link {
  border: 0;
  padding: 4px 0;
  background: none;
  color: var(--color-muted);
  font-size: 13px;
}
.back-link:hover {
  color: var(--color-accent);
}
/* Room for the longest option plus the dropdown arrow, which "w-auto" alone clips. */
.distance-select {
  min-width: 8.5rem;
}
.food-types {
  background: var(--color-paper);
}
.nearby-map {
  height: 70vh;
  min-height: 360px;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  z-index: 0;
}
.nearby-list {
  max-height: 70vh;
  overflow-y: auto;
  padding: 20px;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: var(--color-paper);
}
.list-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-muted);
  margin-bottom: 12px;
}
/* minmax(0, 1fr) lets a long address shrink and truncate instead of widening the cards. */
.nearby-items {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}
.nearby-item {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  background: var(--color-paper);
  color: var(--color-ink);
  text-align: left;
  transition:
    background 220ms,
    border-color 220ms;
}
.nearby-item:hover {
  border-color: var(--color-peach);
}
.nearby-item.selected {
  border-color: var(--color-accent);
  background: #f9ece5;
}
.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  vertical-align: middle;
}
.bg-free {
  background: #8a6a45;
}
.bg-discounted {
  background: var(--color-accent);
}
.bg-here {
  background: #1a73e8;
}
@media (max-width: 991.98px) {
  .nearby-map {
    height: 50vh;
    min-height: 300px;
  }
  .nearby-list {
    max-height: none;
  }
}
@media (max-width: 575px) {
  .food-types {
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .nearby-item {
    transition: none;
  }
}
</style>
