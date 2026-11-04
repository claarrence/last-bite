import { describe, expect, it } from 'vitest'
import { photoUrl } from '@/utils/listings'
import { statusPhotoUrl } from '@/utils/statusUpdates'
import { reviewPhotoUrl } from '@/utils/reviews'

describe.each([
  ['listing', photoUrl, 'listing-photos'],
  ['availability update', statusPhotoUrl, 'listing-update-photos'],
  ['review', reviewPhotoUrl, 'review-photos'],
])('%s photos', (_name, resolvePhoto, bucket) => {
  it('uses bundled demo photos directly', () => {
    expect(resolvePhoto('/images/meal.jpg')).toBe('/images/meal.jpg')
  })

  it.each([
    'https://images.pexels.com/photos/17597408/pexels-photo-17597408.jpeg?auto=compress&w=1000',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Hainanese_chicken_rice_in_Singapore.jpg/960px-Hainanese_chicken_rice_in_Singapore.jpg',
    'http://example.com/food.jpg',
  ])('preserves an online photo link: %s', (url) => {
    expect(resolvePhoto(url)).toBe(url)
  })

  it('builds a storage URL for uploaded photos', () => {
    expect(resolvePhoto('user-1/photo.jpg')).toContain(
      `/storage/v1/object/public/${bucket}/user-1/photo.jpg`,
    )
  })

  it('returns nothing when there is no photo', () => {
    expect(resolvePhoto('')).toBe('')
  })
})
