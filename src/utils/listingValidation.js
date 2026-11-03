import { MAX_PHOTO_BYTES, QUANTITY_LEVELS, UNKNOWN_ALLERGEN } from './listingOptions'

// Combines a 'YYYY-MM-DD' date and 'HH:MM' time into a local Date, or null.
export function toDateTime(date, time) {
  if (!date || !time) return null
  const result = new Date(`${date}T${time}`)
  return Number.isNaN(result.getTime()) ? null : result
}

/**
 * Checks a listing form and returns { fieldName: message } for every problem.
 * An empty object means the form is valid.
 *
 * form: { listingType, title, description, photoFile, price,
 *         quantityTotal, quantityLevel, address, date, start, end, allergens }
 * options: { isEstablishment, now }
 */
export function validateListing(form, { isEstablishment = false, now = new Date() } = {}) {
  const errors = {}

  if (!['free', 'discounted'].includes(form.listingType)) {
    errors.listingType = 'Choose a listing type.'
  } else if (form.listingType === 'discounted' && !isEstablishment) {
    errors.listingType = 'Only establishments can post discounted listings.'
  }

  const title = (form.title ?? '').trim()
  if (!title) errors.title = 'Give your food a name.'
  else if (title.length > 80) errors.title = 'Keep the name under 80 characters.'

  if ((form.description ?? '').length > 500) {
    errors.description = 'Keep the description under 500 characters.'
  }

  if (form.photoFile) {
    if (!form.photoFile.type?.startsWith('image/'))
      errors.photo = 'The photo must be an image file.'
    else if (form.photoFile.size > MAX_PHOTO_BYTES)
      errors.photo = 'The photo must be 5 MB or smaller.'
  }

  if (form.listingType === 'discounted') {
    const price = Number(form.price)
    if (form.price === '' || form.price == null || !(price > 0)) {
      errors.price = 'Enter a price above $0.'
    } else if (price > 9999.99) {
      errors.price = 'Enter a price below $10,000.'
    } else if (!/^\d+(\.\d{1,2})?$/.test(String(form.price))) {
      errors.price = 'Use at most 2 decimal places.'
    }

    const quantity = Number(form.quantityTotal)
    if (!Number.isInteger(quantity) || quantity < 1) {
      errors.quantityTotal = 'Enter a whole number of portions (at least 1).'
    }
  }

  if (form.listingType === 'free') {
    if (!QUANTITY_LEVELS.some((level) => level.value === form.quantityLevel)) {
      errors.quantityLevel = 'Roughly how much is left?'
    }
  }

  if (!(form.address ?? '').trim()) errors.address = 'Enter where people should collect the food.'

  const start = toDateTime(form.date, form.start)
  const end = toDateTime(form.date, form.end)
  if (!form.date) errors.date = 'Pick a collection date.'
  if (!form.start) errors.start = 'Pick a start time.'
  if (!form.end) errors.end = 'Pick an end time.'
  if (start && end) {
    if (end <= start) errors.end = 'The end time must be after the start time.'
    else if (end <= now) errors.end = 'The collection window has already ended.'
  }

  const allergens = form.allergens ?? []
  if (allergens.includes(UNKNOWN_ALLERGEN) && allergens.length > 1) {
    errors.allergens = '"Unknown" cannot be combined with other allergens.'
  }

  return errors
}
