const MINUTE = 60 * 1000

// 45 minutes → "45m", 135 minutes → "2h 15m", 26 hours → "1d 2h".
export function formatDuration(milliseconds) {
  const totalMinutes = Math.max(1, Math.ceil(milliseconds / MINUTE))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  return `${minutes}m`
}

// Text for the pickup countdown chip, or null when there is nothing to count down to.
// urgent is true in the last 30 minutes, so the chip can turn red.
export function pickupCountdown(pickupStart, pickupEnd, now = new Date()) {
  if (!pickupStart || !pickupEnd) return null
  const start = new Date(pickupStart)
  const end = new Date(pickupEnd)
  // The live preview can hold half-typed times that are not real dates yet.
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

  if (now >= end) return null
  if (now < start) {
    return { label: `Opens in ${formatDuration(start - now)}`, urgent: false }
  }
  const timeLeft = end - now
  return { label: `Ends in ${formatDuration(timeLeft)}`, urgent: timeLeft <= 30 * MINUTE }
}
