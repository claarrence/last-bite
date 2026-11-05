import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFiltersStore } from '@/stores/filters'

const NOW = new Date('2026-11-04T18:30:00+08:00')

const nasiLemak = {
  title: 'Nasi lemak',
  address: 'SMU SOE',
  description: 'Workshop leftovers',
  listing_type: 'free',
  dietary_tags: ['Halal'],
  pickup_start: '2026-11-04T18:00:00+08:00',
}
const vegCurry = {
  title: 'Veg curry',
  address: 'Maxwell Food Centre',
  description: null,
  listing_type: 'discounted',
  dietary_tags: ['Halal', 'Vegetarian'],
  pickup_start: '2026-11-04T18:00:00+08:00',
}
const charSiu = {
  title: 'Char siu rice',
  address: 'Tanjong Pagar',
  listing_type: 'free',
  dietary_tags: [],
  pickup_start: '2026-11-04T20:00:00+08:00', // starts after NOW
}
const ALL = [nasiLemak, vegCurry, charSiu]

// Titles of the listings the store would show right now.
const shown = (filters) =>
  ALL.filter((listing) => filters.matchesFunction(listing, NOW)).map((l) => l.title)

let filters

beforeEach(() => {
  setActivePinia(createPinia())
  filters = useFiltersStore()
})

describe('matchesFunction', () => {
  it('shows every listing when no filter is on', () => {
    expect(shown(filters)).toEqual(['Nasi lemak', 'Veg curry', 'Char siu rice'])
  })

  it('filters by food type', () => {
    filters.foodType = 'free'
    expect(shown(filters)).toEqual(['Nasi lemak', 'Char siu rice'])
    filters.foodType = 'discounted'
    expect(shown(filters)).toEqual(['Veg curry'])
  })

  it('searches title, address and description, ignoring case and outer spaces', () => {
    filters.query = '  MAXWELL '
    expect(shown(filters)).toEqual(['Veg curry'])
    filters.query = 'workshop'
    expect(shown(filters)).toEqual(['Nasi lemak'])
  })

  it('needs every ticked dietary tag, not just one of them', () => {
    filters.selectedDietary = ['Halal']
    expect(shown(filters)).toEqual(['Nasi lemak', 'Veg curry'])
    filters.selectedDietary = ['Halal', 'Vegetarian']
    expect(shown(filters)).toEqual(['Veg curry'])
  })

  it('treats a listing without dietary tags as having none', () => {
    filters.selectedDietary = ['Vegan']
    expect(filters.matchesFunction({ ...charSiu, dietary_tags: undefined }, NOW)).toBe(false)
  })

  it('"Available now" hides food whose pickup window has not started', () => {
    filters.availableNow = true
    expect(shown(filters)).toEqual(['Nasi lemak', 'Veg curry'])
  })

  it('combines filters', () => {
    filters.foodType = 'free'
    filters.availableNow = true
    expect(shown(filters)).toEqual(['Nasi lemak'])
  })
})

describe('activeTagsComputed', () => {
  it('is empty when no filter is on', () => {
    expect(filters.activeTagsComputed).toEqual([])
  })

  it('has one tag per active filter, and one per ticked dietary option', () => {
    filters.foodType = 'discounted'
    filters.query = '  rice '
    filters.selectedDietary = ['Halal', 'Vegan']
    filters.availableNow = true
    expect(filters.activeTagsComputed.map((t) => t.label)).toEqual([
      'Reservation food',
      'rice',
      'Halal',
      'Vegan',
      'Available now',
    ])
  })

  it('ignores a search of only spaces', () => {
    filters.query = '   '
    expect(filters.activeTagsComputed).toEqual([])
  })
})

describe('removeTagFunction and clearAllFunction', () => {
  beforeEach(() => {
    filters.foodType = 'free'
    filters.query = 'rice'
    filters.selectedDietary = ['Halal', 'Vegetarian']
    filters.availableNow = true
    filters.sortBy = 'ending'
  })

  const remove = (label) =>
    filters.removeTagFunction(filters.activeTagsComputed.find((t) => t.label === label))

  it('turns off only the filter the tag stands for', () => {
    remove('Free buffet')
    expect(filters.foodType).toBe('all')
    remove('rice')
    expect(filters.query).toBe('')
    remove('Available now')
    expect(filters.availableNow).toBe(false)
    expect(filters.activeTagsComputed.map((t) => t.label)).toEqual(['Halal', 'Vegetarian'])
  })

  it('keeps the other dietary options ticked', () => {
    remove('Halal')
    expect(filters.selectedDietary).toEqual(['Vegetarian'])
  })

  it('clearAll resets every filter but keeps the sort order', () => {
    filters.clearAllFunction()
    expect(filters.activeTagsComputed).toEqual([])
    expect(filters.sortBy).toBe('ending')
  })
})
