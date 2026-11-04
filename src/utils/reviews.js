import { explainError, supabase } from '@/utils/supabase'
import { isDirectPhoto, photoUrl } from '@/utils/listings'

// Review requests. Eligibility (one review per collected reservation) and who may
// edit what are enforced by the database rules in 003_reviews.sql.
const SQL_FILE = '003_reviews.sql'

const PHOTO_BUCKET = 'review-photos'

export function reviewPhotoUrl(path) {
  return photoUrl(path, PHOTO_BUCKET)
}

export async function uploadReviewPhoto(file, userId) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw explainError(error, SQL_FILE)
  return path
}

export async function removeReviewPhoto(path) {
  if (!path || isDirectPhoto(path)) return
  await supabase.storage.from(PHOTO_BUCKET).remove([path])
}

// { id, name, business_type } or null when the provider has no establishment profile.
export async function getEstablishmentProfile(establishmentId) {
  const { data, error } = await supabase.rpc('establishment_profile', { p_id: establishmentId })
  if (error) throw explainError(error, SQL_FILE)
  return data[0] ?? null
}

// All reviews of one establishment, with the reviewed listing's title.
export async function getEstablishmentReviews(establishmentId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, listing:listings(title)')
    .eq('establishment_id', establishmentId)
    .order('created_at', { ascending: false })
  if (error) throw explainError(error, SQL_FILE)
  return data
}

// The signed-in user's reviews, used to show "Write" or "Edit" on My Reservations.
export async function getMyReviews(userId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, reservation_id, establishment_id')
    .eq('author_id', userId)
  if (error) throw explainError(error, SQL_FILE)
  return data
}

export async function getReviewForReservation(reservationId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('reservation_id', reservationId)
    .limit(1)
  if (error) throw explainError(error, SQL_FILE)
  return data[0] ?? null
}

export async function createReview(payload) {
  const { data, error } = await supabase.from('reviews').insert(payload).select().single()
  if (error?.code === '23505') throw new Error('You have already reviewed this order.')
  if (error) throw explainError(error, SQL_FILE)
  return data
}

export async function updateReview(id, patch) {
  const { data, error } = await supabase
    .from('reviews')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw explainError(error, SQL_FILE)
  return data
}

export async function deleteReview(review) {
  const { error } = await supabase.from('reviews').delete().eq('id', review.id)
  if (error) throw explainError(error, SQL_FILE)
  await removeReviewPhoto(review.photo_path)
}

// Providers write, edit or clear (empty text) their public reply.
export function replyToReview(id, reply) {
  return updateReview(id, { reply: reply.trim() || null })
}
