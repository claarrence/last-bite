<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { SINGAPORE, SINGAPORE_BOUNDS } from '@/utils/map'

// A plain L.icon is used because
// L.Icon.Default prefixes its own image path onto the URL, which breaks Vite asset/data URLs.
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
  <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"
    fill="#ad4532" stroke="#873325" stroke-width="1"/>
  <circle cx="12.5" cy="12.5" r="4.5" fill="#fff"/>
</svg>`
const pinIcon = L.icon({
  iconUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PIN_SVG)}`,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
})

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
  tiles = L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
    maxZoom: 19,
    detectRetina: true,
    attribution:
      '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;"/>&nbsp;' +
      '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a>&nbsp;&copy;&nbsp;contributors' +
      '&nbsp;&#124;&nbsp;<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>',
  }).addTo(map)
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
