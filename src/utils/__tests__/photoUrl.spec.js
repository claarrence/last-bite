import { describe, expect, it } from 'vitest'
import { photoUrl } from '@/utils/listings'

describe('photoUrl', () => {
  it('uses bundled demo photos directly', () => {
    expect(photoUrl('/images/meal.jpg')).toBe('/images/meal.jpg')
  })

  it('builds a storage URL for uploaded photos', () => {
    expect(photoUrl('user-1/photo.jpg')).toContain(
      '/storage/v1/object/public/listing-photos/user-1/photo.jpg',
    )
  })

  it('returns nothing when there is no photo', () => {
    expect(photoUrl('')).toBe('')
  })
})
