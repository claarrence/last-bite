import { describe, expect, it } from 'vitest'
import { distanceKm, formatDistance, isInSingapore, listingCoords } from '../map'

describe('listingCoords', () => {
  it('returns numeric coordinates', () => {
    expect(listingCoords({ lat: '1.2966', lng: 103.8502 })).toEqual({ lat: 1.2966, lng: 103.8502 })
  })

  it('returns null for listings that were never pinned', () => {
    expect(listingCoords({ lat: null, lng: null })).toBeNull()
    expect(listingCoords({ lat: 'abc', lng: 103.8 })).toBeNull()
  })
})

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm({ lat: 1.3, lng: 103.8 }, { lat: 1.3, lng: 103.8 })).toBe(0)
  })

  it('measures SMU to Changi Airport at roughly 17 km', () => {
    const km = distanceKm({ lat: 1.2966, lng: 103.8502 }, { lat: 1.3644, lng: 103.9915 })
    expect(km).toBeGreaterThan(16)
    expect(km).toBeLessThan(18)
  })
})

describe('formatDistance', () => {
  it('uses metres under 1 km and kilometres above', () => {
    expect(formatDistance(0.4567)).toBe('457 m')
    expect(formatDistance(2.345)).toBe('2.3 km')
  })
})

describe('isInSingapore', () => {
  it('accepts points in Singapore', () => {
    expect(isInSingapore(1.2966, 103.8502)).toBe(true)
  })

  it('rejects points outside Singapore', () => {
    expect(isInSingapore(3.139, 101.6869)).toBe(false) // Kuala Lumpur
  })
})
