import axios from 'axios'
import { supabase } from '@/utils/supabase'

// Credentials stay on the server. Vite provides the local endpoint; the deployed
// app uses a Supabase Edge Function (or VITE_ONEMAP_PROXY_URL for another host).
async function requestOneMap(params, signal) {
  const endpoint =
    import.meta.env.VITE_ONEMAP_PROXY_URL ||
    (import.meta.env.DEV
      ? '/api/onemap'
      : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onemap`)
  const headers = {}
  if (!import.meta.env.DEV || import.meta.env.VITE_ONEMAP_PROXY_URL) {
    const { data } = await supabase.auth.getSession()
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
    headers.apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  }
  let response
  try {
    response = await axios.get(endpoint, { params, signal, headers })
  } catch (error) {
    // A cancelled search is not a failure; the address picker ignores it.
    if (axios.isCancel(error)) throw error
    // Axios rejects non-2xx replies; show the proxy's own message when it sent one.
    throw new Error(
      error.response?.data?.error || 'Address search is unavailable. Enter the address manually.',
      { cause: error },
    )
  }
  if (response.data.error) throw new Error(response.data.error)
  return response.data
}

export async function searchAddress(query, { limit = 8, signal } = {}) {
  const searchVal = query.trim()
  if (searchVal.length < 3) return []
  const { results = [] } = await requestOneMap({ mode: 'search', query: searchVal }, signal)
  return results
    .map((result) => ({
      label: result.BUILDING && result.BUILDING !== 'NIL' ? result.BUILDING : result.SEARCHVAL,
      address: result.ADDRESS,
      postal: result.POSTAL !== 'NIL' ? result.POSTAL : '',
      lat: result.LATITUDE ? Number(result.LATITUDE) : NaN,
      lng: result.LONGITUDE ? Number(result.LONGITUDE) : NaN,
    }))
    .filter(
      (result) => result.address && Number.isFinite(result.lat) && Number.isFinite(result.lng),
    )
    .slice(0, limit)
}

const clean = (value) => (value && value !== 'NIL' && value !== 'null' ? value : '')

export async function reverseGeocode(lat, lng, { signal } = {}) {
  const data = await requestOneMap({ mode: 'reverse', lat, lng }, signal)
  const place = data.GeocodeInfo?.[0]
  if (!place) return ''
  const postal = clean(place.POSTALCODE)
  return [
    clean(place.BLOCK),
    clean(place.ROAD),
    clean(place.BUILDINGNAME),
    postal && `SINGAPORE ${postal}`,
  ]
    .filter(Boolean)
    .join(' ')
}
