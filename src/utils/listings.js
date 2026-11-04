import { supabase } from '@/utils/supabase'

const PHOTO_BUCKET = 'listing-photos'

export function isDirectPhoto(path) {
  return path.startsWith('/images/') || /^https?:\/\//i.test(path)
}

export function photoUrl(path, bucket = PHOTO_BUCKET) {
  if (!path) return ''
  if (isDirectPhoto(path)) return path
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

// 'open' | 'closed' | 'expired'. Expiry is computed rather than stored.
export function displayStatus(listing, now = new Date()) {
  if (listing.status === 'closed') return 'closed'
  if (new Date(listing.pickup_end) <= now) return 'expired'
  return 'open'
}

export async function uploadListingPhoto(file, userId) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return path
}

export async function removeListingPhoto(path) {
  if (!path || isDirectPhoto(path)) return
  await supabase.storage.from(PHOTO_BUCKET).remove([path])
}

export async function createListing(payload) {
  const { data, error } = await supabase.from('listings').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateListing(id, patch) {
  const { data, error } = await supabase
    .from('listings')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getListing(id) {
  const { data, error } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function getMyListings(userId) {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Both roles browse the same open listings whose pickup window has not ended.
export async function getAvailableListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'open')
    .gt('pickup_end', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// The database refuses to delete a listing that has reservation records
// (foreign-key error 23503), so booking history is never lost.
export async function deleteListing(listing) {
  const { error } = await supabase.from('listings').delete().eq('id', listing.id)
  if (error?.code === '23503') {
    throw new Error('This listing has reservations, so it cannot be deleted. Close it instead.')
  }
  if (error) throw error
  await removeListingPhoto(listing.photo_path)
}
