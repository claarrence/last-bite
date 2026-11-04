import { describe, it, expect } from 'vitest'
import { sortReviews, summarizeReviews, validateReview } from '../reviewRules'

const validForm = { rating: 4, tags: ['Fresh'], comment: 'Tasty', photoFile: null }

describe('validateReview', () => {
  it('accepts a rating with optional tags and comment', () => {
    expect(validateReview(validForm)).toEqual({})
    expect(validateReview({ ...validForm, tags: [], comment: '' })).toEqual({})
  })

  it('requires a star rating from 1 to 5', () => {
    for (const rating of [0, 6, 2.5]) {
      expect(validateReview({ ...validForm, rating }).rating).toBe(
        'Choose a star rating from 1 to 5.',
      )
    }
  })

  it('rejects unknown tags and long comments', () => {
    expect(validateReview({ ...validForm, tags: ['Cheap'] }).tags).toBeTruthy()
    expect(validateReview({ ...validForm, comment: 'a'.repeat(501) }).comment).toBeTruthy()
  })

  it('checks the photo type and size', () => {
    const pdf = { type: 'application/pdf', size: 1000 }
    const huge = { type: 'image/jpeg', size: 6 * 1024 * 1024 }
    expect(validateReview({ ...validForm, photoFile: pdf }).photo).toBe(
      'The photo must be an image file.',
    )
    expect(validateReview({ ...validForm, photoFile: huge }).photo).toBe(
      'The photo must be 5 MB or smaller.',
    )
  })
})

describe('summarizeReviews', () => {
  it('returns zeros when there are no reviews', () => {
    expect(summarizeReviews([])).toEqual({ average: 0, count: 0, topTags: [] })
  })

  it('averages ratings to one decimal place and counts reviews', () => {
    const reviews = [
      { rating: 5, tags: [] },
      { rating: 4, tags: [] },
      { rating: 4, tags: [] },
    ]
    const summary = summarizeReviews(reviews)
    expect(summary.average).toBe(4.3)
    expect(summary.count).toBe(3)
  })

  it('lists the three most common tags', () => {
    const reviews = [
      { rating: 5, tags: ['Fresh', 'Easy to find'] },
      { rating: 4, tags: ['Fresh', 'Generous portion'] },
      { rating: 3, tags: ['Fresh', 'Easy to find', 'As described'] },
    ]
    expect(summarizeReviews(reviews).topTags).toEqual([
      { tag: 'Fresh', count: 3 },
      { tag: 'Easy to find', count: 2 },
      { tag: 'Generous portion', count: 1 },
    ])
  })
})

describe('sortReviews', () => {
  const old5 = { id: 'old5', rating: 5, created_at: '2026-10-01T10:00:00Z' }
  const new3 = { id: 'new3', rating: 3, created_at: '2026-10-10T10:00:00Z' }
  const mid5 = { id: 'mid5', rating: 5, created_at: '2026-10-05T10:00:00Z' }
  const ids = (list) => list.map((r) => r.id)

  it('sorts newest first', () => {
    expect(ids(sortReviews([old5, new3, mid5], 'recent'))).toEqual(['new3', 'mid5', 'old5'])
  })

  it('sorts highest rating first, newest first among equal ratings', () => {
    expect(ids(sortReviews([old5, new3, mid5], 'highest'))).toEqual(['mid5', 'old5', 'new3'])
  })

  it('does not change the original array', () => {
    const original = [old5, new3]
    sortReviews(original, 'recent')
    expect(ids(original)).toEqual(['old5', 'new3'])
  })
})
