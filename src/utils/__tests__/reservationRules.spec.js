import { describe, it, expect } from 'vitest'
import {
  remainingPortions,
  reservationStatus,
  reservationTotal,
  validateQuantity,
} from '../reservationRules'

const NOW = new Date('2026-10-13T12:00:00')
const LATER = '2026-10-13T19:00:00'
const EARLIER = '2026-10-13T11:00:00'

describe('reservationStatus', () => {
  it('is reserved while the pickup window is still open', () => {
    expect(reservationStatus({ status: 'reserved' }, LATER, NOW)).toBe('reserved')
  })

  it('shows an uncollected reservation as expired after the pickup window', () => {
    expect(reservationStatus({ status: 'reserved' }, EARLIER, NOW)).toBe('expired')
  })

  it('keeps collected and cancelled reservations as they are', () => {
    expect(reservationStatus({ status: 'collected' }, EARLIER, NOW)).toBe('collected')
    expect(reservationStatus({ status: 'cancelled' }, LATER, NOW)).toBe('cancelled')
  })
})

describe('remainingPortions', () => {
  it('subtracts reserved portions from the total', () => {
    expect(remainingPortions(8, 3)).toBe(5)
  })

  it('treats a listing with no reservations as fully available', () => {
    expect(remainingPortions(8, undefined)).toBe(8)
  })

  it('never goes below zero', () => {
    expect(remainingPortions(5, 7)).toBe(0)
  })
})

describe('validateQuantity', () => {
  it('accepts a whole number within the available portions', () => {
    expect(validateQuantity(2, 5)).toBe('')
    expect(validateQuantity(5, 5)).toBe('')
  })

  it('rejects empty, zero, negative and decimal quantities', () => {
    for (const bad of ['', 0, -1, 1.5]) {
      expect(validateQuantity(bad, 5)).toBe('Enter a whole number of portions (at least 1).')
    }
  })

  it('rejects more portions than are available', () => {
    expect(validateQuantity(6, 5)).toBe('Only 5 portions available.')
    expect(validateQuantity(2, 1)).toBe('Only 1 portion available.')
  })
})

describe('reservationTotal', () => {
  it('multiplies quantity by the agreed price', () => {
    expect(reservationTotal(2, 3.5)).toBe(7)
  })

  it('rounds to cents', () => {
    expect(reservationTotal(3, 0.1)).toBe(0.3)
  })

  it('accepts the price as returned by the database (a string)', () => {
    expect(reservationTotal(3, '3.50')).toBe(10.5)
  })
})
