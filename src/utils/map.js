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

/** Listing coordinates as numbers, or null if the listing was never pinned. */
export function listingCoords(listing) {
  if (listing?.lat == null || listing?.lng == null) return null
  const lat = Number(listing.lat)
  const lng = Number(listing.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}
