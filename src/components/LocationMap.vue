<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import {
  addOneMapTiles,
  discountedPinIcon as pinIcon,
  SINGAPORE,
  SINGAPORE_BOUNDS,
} from '@/utils/map'

// results: OneMap search results shown as grey dots. lat/lng: the chosen pickup spot.
// Emits `pick` with { lat, lng, address? }: address is set when a search result was clicked,
// and missing when the user clicked/dragged on the map (the parent reverse-geocodes it).
// readonly: just show the pin (listing detail page); no clicking or dragging.
const props = defineProps({
  results: { type: Array, default: () => [] },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['pick'])

const el = ref(null)
const tileError = ref(false)
let tiles = null
let resizeObserver = null
let map = null
let resultLayer = null
let pin = null

onMounted(() => {
  map = L.map(el.value, {
    center: SINGAPORE,
    zoom: 12,
    minZoom: 11,
    maxBounds: L.latLngBounds(SINGAPORE_BOUNDS),
  })
  tiles = addOneMapTiles(map)
  tiles.on('tileerror', () => {
    tileError.value = true
  })
  tiles.on('tileload', () => {
    tileError.value = false
  })
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => map?.invalidateSize())
    resizeObserver.observe(el.value)
  }

  resultLayer = L.layerGroup().addTo(map)
  if (!props.readonly)
    map.on('click', (e) => emit('pick', { lat: e.latlng.lat, lng: e.latlng.lng }))

  drawResults()
  drawPin(true)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  map?.remove()
})

function drawResults() {
  resultLayer.clearLayers()
  const points = props.results.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
  for (const result of points) {
    L.circleMarker([result.lat, result.lng], {
      radius: 8,
      color: '#6c757d',
      fillColor: '#adb5bd',
      fillOpacity: 0.9,
    })
      .bindTooltip(`<strong>${escapeHtml(result.label)}</strong><br>${escapeHtml(result.address)}`)
      .on('click', (e) => {
        if (props.readonly) return
        L.DomEvent.stopPropagation(e)
        emit('pick', { lat: result.lat, lng: result.lng, address: result.address })
      })
      .addTo(resultLayer)
  }
  if (points.length > 1)
    map.fitBounds(L.latLngBounds(points.map((r) => [r.lat, r.lng])), { padding: [24, 24] })
  else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 17)
}

function drawPin(recenter) {
  if (
    props.lat == null ||
    props.lng == null ||
    !Number.isFinite(props.lat) ||
    !Number.isFinite(props.lng)
  ) {
    pin?.remove()
    pin = null
    return
  }
  const position = [props.lat, props.lng]
  if (!pin) {
    pin = L.marker(position, {
      icon: pinIcon,
      draggable: !props.readonly,
      title: props.readonly ? 'Pickup location' : 'Pickup location (drag to adjust)',
    }).addTo(map)
    pin.on('dragend', () => {
      const { lat, lng } = pin.getLatLng()
      emit('pick', { lat, lng })
    })
  } else {
    pin.setLatLng(position)
  }
  if (recenter) map.setView(position, Math.max(map.getZoom(), 17))
}

function escapeHtml(text = '') {
  return String(text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

watch(() => props.results, drawResults)
watch(
  () => [props.lat, props.lng],
  () => drawPin(!props.results.length),
)
</script>

<template>
  <div>
    <div
      ref="el"
      class="location-map border"
      data-testid="location-map"
      role="region"
      aria-label="Pickup location map"
    ></div>
    <p v-if="tileError" class="small text-secondary mt-2 mb-0" role="status">
      Map tiles could not load. You can still search or enter an address.
      <button type="button" class="btn btn-sm btn-outline-secondary ms-1" @click="tiles.redraw()">
        Retry map
      </button>
    </p>
  </div>
</template>

<style scoped>
.location-map {
  height: 280px;
  z-index: 0;
  border-radius: 12px;
}
</style>
