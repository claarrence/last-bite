import { explainError, supabase } from '@/utils/supabase'

// Every change goes through a database function (see 002_reservations.sql),
// which checks stock, ownership and the pickup window before saving.
const SQL_FILE = '002_reservations.sql'

const LISTING_FIELDS =
  'id, owner_id, title, photo_path, address, collection_instructions, pickup_start, pickup_end, status'

// { [listingId]: portions already reserved or collected }
export async function getReservedQuantities(listingIds) {
  if (!listingIds.length) return {}
  const { data, error } = await supabase.rpc('reserved_quantities', {
    p_listing_ids: listingIds,
  })
  if (error) throw explainError(error, SQL_FILE)
  const totals = {}
  for (const row of data) totals[row.listing_id] = row.reserved
  return totals
}

// Adds quantity_remaining to discounted listings for the browse cards.
// If the totals cannot be loaded, the cards fall back to the listed quantity.
export async function withRemainingPortions(listings) {
  const discounted = listings.filter((listing) => listing.listing_type === 'discounted')
  const ids = discounted.map((listing) => listing.id)

  let reserved
  try {
    reserved = await getReservedQuantities(ids)
  } catch {
    return listings
  }

  for (const listing of discounted) {
    listing.quantity_remaining = listing.quantity_total - (reserved[listing.id] || 0)
  }
  return listings
}

export async function createReservation(listingId, quantity) {
  const { data, error } = await supabase.rpc('create_reservation', {
    p_listing_id: listingId,
    p_quantity: quantity,
  })
  if (error) throw explainError(error, SQL_FILE)
  return data
}

export async function updateReservationQuantity(reservationId, quantity) {
  const { data, error } = await supabase.rpc('update_reservation_quantity', {
    p_reservation_id: reservationId,
    p_quantity: quantity,
  })
  if (error) throw explainError(error, SQL_FILE)
  return data
}

export async function cancelReservation(reservationId) {
  const { data, error } = await supabase.rpc('cancel_reservation', {
    p_reservation_id: reservationId,
  })
  if (error) throw explainError(error, SQL_FILE)
  return data
}

export async function markReservationCollected(listingId, pickupCode) {
  const { data, error } = await supabase.rpc('mark_reservation_collected', {
    p_listing_id: listingId,
    p_pickup_code: pickupCode,
  })
  if (error) throw explainError(error, SQL_FILE)
  return data
}

// The signed-in customer's bookings, newest first, with the listing details.
export async function getMyReservations(userId) {
  const { data, error } = await supabase
    .from('reservations')
    .select(`*, listing:listings(${LISTING_FIELDS})`)
    .eq('customer_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw explainError(error, SQL_FILE)
  return data
}

// One of the signed-in customer's reservations with its listing, or null.
export async function getReservation(reservationId) {
  const { data, error } = await supabase
    .from('reservations')
    .select(`*, listing:listings(${LISTING_FIELDS})`)
    .eq('id', reservationId)
    .limit(1)
  if (error) throw explainError(error, SQL_FILE)
  return data[0] || null
}

// The customer's active reservation for one listing, or null.
export async function getActiveReservation(listingId, userId) {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('listing_id', listingId)
    .eq('customer_id', userId)
    .eq('status', 'reserved')
    .limit(1)
  if (error) throw explainError(error, SQL_FILE)
  return data[0] || null
}

// All reservations for a listing; only its owner can read them (database rule).
export async function getListingReservations(listingId) {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true })
  if (error) throw explainError(error, SQL_FILE)
  return data
}
