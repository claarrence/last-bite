// Reservation display rules. The database enforces the real limits;
// these helpers only give the user early feedback and labels.

export const RESERVATION_TABS = [
  { key: 'reserved', label: 'Active' },
  { key: 'collected', label: 'Collected' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'expired', label: 'Expired' },
]

export const RESERVATION_BADGES = {
  reserved: { label: 'Reserved', cls: 'badge-green' },
  collected: { label: 'Collected', cls: 'badge-sand' },
  cancelled: { label: 'Cancelled', cls: 'badge-grey' },
  expired: { label: 'Expired', cls: 'badge-ink' },
}

// 'reserved' | 'collected' | 'cancelled' | 'expired'.
// Expired is not stored: an active reservation expires when its pickup window ends.
export function reservationStatus(reservation, pickupEnd, now = new Date()) {
  if (reservation.status !== 'reserved') return reservation.status
  if (new Date(pickupEnd) <= now) return 'expired'
  return 'reserved'
}

export function remainingPortions(quantityTotal, reserved) {
  return Math.max(0, Number(quantityTotal) - Number(reserved || 0))
}

// Returns an error message, or '' when the quantity is acceptable.
export function validateQuantity(quantity, maxAvailable) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return 'Enter a whole number of portions (at least 1).'
  }
  if (quantity > maxAvailable) {
    return `Only ${maxAvailable} portion${maxAvailable === 1 ? '' : 's'} available.`
  }
  return ''
}

// Rounded to cents so 3 × S$0.10 shows S$0.30, not S$0.30000000000000004.
export function reservationTotal(quantity, unitPrice) {
  return Math.round(Number(quantity) * Number(unitPrice) * 100) / 100
}
