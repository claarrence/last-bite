import { afterEach, describe, expect, it, vi } from 'vitest'
import { photoUrl, removeListingPhoto } from '@/utils/listings'
import { supabase } from '@/utils/supabase'
import { statusPhotoUrl } from '@/utils/statusUpdates'
import { reviewPhotoUrl, removeReviewPhoto } from '@/utils/reviews'

afterEach(() => vi.restoreAllMocks())

describe.each([
  ['listing', photoUrl, 'listing-photos'],
  ['availability', statusPhotoUrl, 'listing-update-photos'],
  ['review', reviewPhotoUrl, 'review-photos'],
])('%s photo URLs', (_name, resolvePhoto, bucket) => {
  it('uses bundled photos directly', () => {
    expect(resolvePhoto('/images/meal.jpg')).toBe('/images/meal.jpg')
  })

  it('uses online images directly', () => {
    const url = 'https://images.pexels.com/photos/7111470/pexels-photo-7111470.jpeg'
    expect(resolvePhoto(url)).toBe(url)
  })

  it('uses the correct bucket for uploaded photos', () => {
    expect(resolvePhoto('user-1/photo.jpg')).toContain(
      `/storage/v1/object/public/${bucket}/user-1/photo.jpg`,
    )
  })

  it('returns nothing when there is no photo', () => {
    expect(resolvePhoto('')).toBe('')
  })
})

describe.each([
  ['listing', removeListingPhoto, 'listing-photos'],
  ['review', removeReviewPhoto, 'review-photos'],
])('remove %s photos', (_name, removePhoto, bucket) => {
  it.each(['', '/images/meal.jpg', 'https://example.com/food.jpg'])(
    'leaves non-storage photos alone: %s',
    async (path) => {
      const from = vi.spyOn(supabase.storage, 'from')
      await removePhoto(path)
      expect(from).not.toHaveBeenCalled()
    },
  )

  it('still removes uploaded photos from their storage bucket', async () => {
    const remove = vi.fn().mockResolvedValue({ error: null })
    const from = vi.spyOn(supabase.storage, 'from').mockReturnValue({ remove })
    await removePhoto('user-1/photo.jpg')
    expect(from).toHaveBeenCalledWith(bucket)
    expect(remove).toHaveBeenCalledWith(['user-1/photo.jpg'])
  })
})
