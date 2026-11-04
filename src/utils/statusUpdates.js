import { supabase } from '@/utils/supabase'
import { photoUrl } from '@/utils/listings'

export const UPDATE_OPTIONS = [
  { value: 'still_available', label: 'Still available', badge: 'badge-green', btn: 'btn-outline-success' },
  { value: 'running_low', label: 'Running low', badge: 'badge-peach', btn: 'btn-outline-warning' },
  { value: 'all_gone', label: 'All gone', badge: 'badge-grey', btn: 'btn-outline-secondary' },
]

export const VERIFIED_WINDOW_MS = 15 * 60 * 1000
const PHOTO_BUCKET = 'listing-update-photos'

export function optionFor(status) {
  return UPDATE_OPTIONS.find((o) => o.value === status)
}

// `updates` is sorted newest first. "All gone" is not a confirmation that
// food exists, so only the other two statuses can verify a listing.
export function isVerifiedRecently(updates, now = new Date()) {
  const latest = updates[0]
  if (!latest || latest.status === 'all_gone') return false
  return now - new Date(latest.created_at) <= VERIFIED_WINDOW_MS
}

export function timeAgo(iso, now = new Date()) {
  const mins = Math.floor((now - new Date(iso)) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  return `${Math.floor(hrs / 24)} d ago`
}


export async function getListingUpdates(listingId, limit = 10) {
  const { data, error } = await supabase
    .from('listing_updates')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function postListingUpdate({ listingId, userId, status, photo }) {
  const ext = photo.name.split('.').pop() || 'jpg'
  const path = `updates/${listingId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('listing-update-photos').upload(path, photo)
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('listing_updates')
    .insert({ listing_id: listingId, user_id: userId, status, photo_path: path })
    .select()
    .single()
  if (error) throw error
  return data
}

export function subscribeToListingUpdates(listingId, onInsert) {
  const channel = supabase
    .channel(`listing-updates-${listingId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'listing_updates',
        filter: `listing_id=eq.${listingId}`,
      },
      (payload) => onInsert(payload.new),
    )
    .subscribe()

  // Return a function that stops listening.
  return () => supabase.removeChannel(channel)
}

export function statusPhotoUrl(path) {
  return photoUrl(path, PHOTO_BUCKET)
}
