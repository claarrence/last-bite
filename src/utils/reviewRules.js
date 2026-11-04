import { MAX_PHOTO_BYTES } from './listingOptions'

// Quick feedback tags; the database accepts only these values.
export const REVIEW_TAGS = ['Fresh', 'As described', 'Generous portion', 'Easy to find']

export const REVIEW_SORTS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'highest', label: 'Highest rated' },
]

export const MAX_COMMENT_LENGTH = 500

// form: { rating, tags, comment, photoFile }. Returns { field: message }; {} means valid.
export function validateReview(form) {
  const errors = {}

  if (!Number.isInteger(form.rating) || form.rating < 1 || form.rating > 5) {
    errors.rating = 'Choose a star rating from 1 to 5.'
  }
  if (!form.tags.every((tag) => REVIEW_TAGS.includes(tag))) {
    errors.tags = 'Choose tags from the list.'
  }
  if ((form.comment ?? '').length > MAX_COMMENT_LENGTH) {
    errors.comment = `Keep the comment under ${MAX_COMMENT_LENGTH} characters.`
  }
  if (form.photoFile) {
    if (!form.photoFile.type?.startsWith('image/')) {
      errors.photo = 'The photo must be an image file.'
    } else if (form.photoFile.size > MAX_PHOTO_BYTES) {
      errors.photo = 'The photo must be 5 MB or smaller.'
    }
  }
  return errors
}

// Average rating (one decimal place), number of reviews and the most common tags.
export function summarizeReviews(reviews) {
  if (!reviews.length) return { average: 0, count: 0, topTags: [] }

  let total = 0
  const tagCounts = {}
  for (const review of reviews) {
    total += review.rating
    for (const tag of review.tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
    }
  }

  const topTags = Object.keys(tagCounts)
    .map((tag) => ({ tag, count: tagCounts[tag] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return {
    average: Math.round((total / reviews.length) * 10) / 10,
    count: reviews.length,
    topTags,
  }
}

// Returns a sorted copy: newest first, or highest rating first (newest breaks ties).
export function sortReviews(reviews, sortBy) {
  const newestFirst = (a, b) => new Date(b.created_at) - new Date(a.created_at)
  return [...reviews].sort((a, b) => {
    if (sortBy === 'highest' && a.rating !== b.rating) return b.rating - a.rating
    return newestFirst(a, b)
  })
}
