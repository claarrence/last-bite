import { describe, expect, it } from 'vitest'


import {
  UPDATE_OPTIONS,
  VERIFIED_WINDOW_MS,
  isVerifiedRecently,
  optionFor,
  timeAgo,
} from '@/utils/statusUpdates'

const MIN = 60 * 1000
const NOW = new Date('2026-10-27T10:00:00Z')
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString()


describe('UPDATE_OPTIONS / optionFor', () => {
  it('offers exactly the three statuses, in order', () => {
    expect(UPDATE_OPTIONS.map((o) => o.value)).toEqual([
      'still_available',
      'running_low',
      'all_gone',
    ])
    expect(UPDATE_OPTIONS.map((o) => o.label)).toEqual([
      'Still available',
      'Running low',
      'All gone',
    ])
  })

  it('finds an option by its value', () => {
    expect(optionFor('running_low').label).toBe('Running low')
  })

  it('returns undefined for an unknown status', () => {
    expect(optionFor('nope')).toBeUndefined()
  })
})

describe('isVerifiedRecently', () => {
  it('uses a 15 minute window', () => {
    expect(VERIFIED_WINDOW_MS).toBe(15 * MIN)
  })

  it('is false when there are no updates', () => {
    expect(isVerifiedRecently([], NOW)).toBe(false)
  })

  it('is still true at exactly 15 minutes', () => {
    const updates = [{ status: 'still_available', created_at: ago(15 * MIN) }]
    expect(isVerifiedRecently(updates, NOW)).toBe(true)
  })

  it('is false one second past 15 minutes', () => {
    const updates = [{ status: 'still_available', created_at: ago(15 * MIN + 1000) }]
    expect(isVerifiedRecently(updates, NOW)).toBe(false)
  })

  it('defaults "now" to the current time', () => {
    const updates = [{ status: 'still_available', created_at: new Date().toISOString() }]
    expect(isVerifiedRecently(updates)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('timeAgo', () => {
  it.each([
    ['0 seconds', 0, 'Just now'],
    ['59 seconds', 59 * 1000, 'Just now'],
    ['1 minute', 1 * MIN, '1 min ago'],
    ['59 minutes', 59 * MIN, '59 min ago'],
    ['60 minutes', 60 * MIN, '1 h ago'],
    ['23 h 59 min', 23 * 60 * MIN + 59 * MIN, '23 h ago'],
    ['24 hours', 24 * 60 * MIN, '1 d ago'],
    ['49 hours', 49 * 60 * MIN, '2 d ago'],
  ])('%s old -> "%s"', (_label, ms, expected) => {
    expect(timeAgo(ago(ms), NOW)).toBe(expected)
  })
})