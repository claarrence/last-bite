import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

export const SINGAPORE = [1.3521, 103.8198]
// South-west and north-east corners the maps are limited to.
export const SINGAPORE_BOUNDS = [
  [1.144, 103.535],
  [1.494, 104.1],
]

/** True when a point lies inside the Singapore map area. */
export function isInSingapore(lat, lng) {
  const south = SINGAPORE_BOUNDS[0][0]
  const west = SINGAPORE_BOUNDS[0][1]
  const north = SINGAPORE_BOUNDS[1][0]
  const east = SINGAPORE_BOUNDS[1][1]
  return lat >= south && lat <= north && lng >= west && lng <= east
}

// Leaflet-shaped pin. A plain L.icon is used because
// L.Icon.Default prefixes its own image path onto the URL, which breaks Vite asset/data URLs.
function pinSvg(fill, stroke) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
  <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"
    fill="${fill}" stroke="${stroke}" stroke-width="1"/>
  <circle cx="12.5" cy="12.5" r="4.5" fill="#fff"/>
</svg>`
}

function makePin(fill, stroke) {
  return L.icon({
    iconUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg(fill, stroke))}`,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
  })
}

// Free food uses a sand-brown pin; discounted food uses the terracotta accent
// (--color-accent), so the two types are easy to tell apart.
export const pinIcon = makePin('#8a6a45', '#6b4c29')
export const discountedPinIcon = makePin('#ad4532', '#873325')

/** Creates a Leaflet map on `el` with OneMap's Singapore basemap. */
export function createOneMap(el, options = {}) {
  const map = L.map(el, {
    center: SINGAPORE,
    zoom: 12,
    minZoom: 11,
    maxBounds: L.latLngBounds(SINGAPORE_BOUNDS),
    ...options,
  })
  L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
    maxZoom: 19,
    detectRetina: true,
    attribution:
      '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;"/>&nbsp;' +
      '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a>&nbsp;&copy;&nbsp;contributors' +
      '&nbsp;&#124;&nbsp;<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>',
  }).addTo(map)
  return map
}

/** Listing coordinates as numbers, or null if the listing was never pinned. */
export function listingCoords(listing) {
  if (listing?.lat == null || listing?.lng == null) return null
  const lat = Number(listing.lat)
  const lng = Number(listing.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

/** Straight-line distance in km between two { lat, lng } points (haversine). */
export function distanceKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

/** The browser's position as a promise, so pages can await it inside try/catch. */
export function getBrowserPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

export function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}
