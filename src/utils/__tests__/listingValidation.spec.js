import { describe, it, expect } from 'vitest'
import { toDateTime, validateListing } from '../listingValidation'

const NOW = new Date('2026-10-13T12:00:00')
const photo = { type: 'image/jpeg', size: 200_000 }

function freeForm(overrides = {}) {
  return {
    listingType: 'free',
    title: 'Buffet pastries',
    description: '',
    photoFile: photo,
    price: '',
    quantityTotal: '',
    quantityLevel: 'some',
    address: 'SMU SOE 2-3',
    date: '2026-10-13',
    start: '18:00',
    end: '19:00',
    allergens: [],
    ...overrides,
  }
}

function discountedForm(overrides = {}) {
  return freeForm({
    listingType: 'discounted',
    quantityLevel: '',
    price: 3,
    quantityTotal: 8,
    ...overrides,
  })
}

const validate = (form, isEstablishment = false) =>
  validateListing(form, { isEstablishment, now: NOW })

describe('validateListing', () => {
  it('accepts a complete free listing', () => {
    expect(validate(freeForm())).toEqual({})
  })

  it('accepts a complete discounted listing from an establishment', () => {
    expect(validate(discountedForm(), true)).toEqual({})
  })

  it('rejects discounted listings from normal users', () => {
    expect(validate(discountedForm(), false)).toHaveProperty('listingType')
  })

  it('requires a title', () => {
    expect(validate(freeForm({ title: '   ' }))).toHaveProperty('title')
  })

  describe('photo', () => {
    it('is required for a new free listing', () => {
      expect(validate(freeForm({ photoFile: null }))).toHaveProperty('photo')
    })

    it('is required for a new discounted listing', () => {
      expect(validate(discountedForm({ photoFile: null }), true)).toHaveProperty('photo')
    })

    it('can be left empty when editing a listing that already has one', () => {
      expect(validate(freeForm({ photoFile: null, existingPhotoPath: 'user/photo.jpg' }))).toEqual(
        {},
      )
    })

    it('must be an image', () => {
      expect(
        validate(freeForm({ photoFile: { type: 'application/pdf', size: 100 } })),
      ).toHaveProperty('photo')
    })

    it('must be 5 MB or smaller', () => {
      expect(
        validate(freeForm({ photoFile: { type: 'image/png', size: 6 * 1024 * 1024 } })),
      ).toHaveProperty('photo')
    })
  })

  describe('discounted quantity and price', () => {
    it.each(['', 0, -1, 'abc'])('rejects price %s', (price) => {
      expect(validate(discountedForm({ price }), true)).toHaveProperty('price')
    })

    it('rejects more than 2 decimal places', () => {
      expect(validate(discountedForm({ price: 3.999 }), true)).toHaveProperty('price')
    })

    it.each([0, 1.5, -2, ''])('rejects quantity %s', (quantityTotal) => {
      expect(validate(discountedForm({ quantityTotal }), true)).toHaveProperty('quantityTotal')
    })

    it('ignores the free quantity level', () => {
      expect(validate(discountedForm({ quantityLevel: '' }), true)).not.toHaveProperty(
        'quantityLevel',
      )
    })
  })

  describe('free quantity level', () => {
    it('is required', () => {
      expect(validate(freeForm({ quantityLevel: '' }))).toHaveProperty('quantityLevel')
    })

    it('must be a known level', () => {
      expect(validate(freeForm({ quantityLevel: 'loads' }))).toHaveProperty('quantityLevel')
    })

    it('does not need a price', () => {
      expect(validate(freeForm({ price: '' }))).not.toHaveProperty('price')
    })
  })

  describe('collection window', () => {
    it('requires the end to be after the start', () => {
      expect(validate(freeForm({ start: '19:00', end: '18:00' }))).toHaveProperty('end')
    })

    it('rejects a window that has already ended', () => {
      expect(validate(freeForm({ start: '09:00', end: '11:00' }))).toHaveProperty('end')
    })

    it('accepts a window that is in progress', () => {
      expect(validate(freeForm({ start: '11:00', end: '13:00' }))).toEqual({})
    })

    it('requires date and times', () => {
      const errors = validate(freeForm({ date: '', start: '', end: '' }))
      expect(errors).toHaveProperty('date')
      expect(errors).toHaveProperty('start')
      expect(errors).toHaveProperty('end')
    })

    it('only flags the date when times are already selected', () => {
      expect(validate(freeForm({ date: '' }))).toEqual({ date: 'Pick a collection date.' })
    })
  })

  describe('allergens', () => {
    it('allows several known allergens', () => {
      expect(validate(freeForm({ allergens: ['Fish', 'Shellfish'] }))).toEqual({})
    })

    it('allows Unknown on its own', () => {
      expect(validate(freeForm({ allergens: ['Unknown'] }))).toEqual({})
    })

    it('rejects Unknown combined with other allergens', () => {
      expect(validate(freeForm({ allergens: ['Unknown', 'Fish'] }))).toHaveProperty('allergens')
    })
  })
})

describe('toDateTime', () => {
  it('combines a date and time', () => {
    expect(toDateTime('2026-10-13', '18:30')).toEqual(new Date('2026-10-13T18:30'))
  })

  it('returns null when either part is missing', () => {
    expect(toDateTime('', '18:30')).toBeNull()
    expect(toDateTime('2026-10-13', '')).toBeNull()
  })
})
