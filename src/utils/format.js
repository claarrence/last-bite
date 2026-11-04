const dayFormat = new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const timeFormat = new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore',
  hour: 'numeric',
  minute: '2-digit',
})

// "Mon 13 Oct · 6:00 pm – 7:00 pm"
export function formatPickupWindow(start, end) {
  if (!start || !end) return ''
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return ''
  return `${dayFormat.format(startDate)} · ${timeFormat.format(startDate)} – ${timeFormat.format(endDate)}`
}

export function formatPrice(price) {
  const value = Number(price)
  if (!(value > 0)) return ''
  return `S$${value.toFixed(2)}`
}

// Local 'YYYY-MM-DD' and 'HH:MM' strings for date/time inputs.
const pad = (n) => String(n).padStart(2, '0')

export function toDateInput(value) {
  const d = new Date(value)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toTimeInput(value) {
  const d = new Date(value)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
