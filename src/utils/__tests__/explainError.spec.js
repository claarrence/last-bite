import { describe, expect, it } from 'vitest'
import { explainError } from '@/utils/supabase'

describe('explainError', () => {
  it('names the SQL file to run when a table is missing', () => {
    const error = { code: 'PGRST205', message: "Could not find the table 'public.reservations'" }
    expect(explainError(error, '002_reservations.sql').message).toBe(
      'This feature is not set up yet. Run supabase/migrations/002_reservations.sql in the Supabase SQL Editor.',
    )
  })

  it('does the same when a database function is missing', () => {
    const error = { code: 'PGRST202', message: 'Could not find the function' }
    expect(explainError(error, '003_reviews.sql').message).toContain('003_reviews.sql')
  })

  it('keeps every other error unchanged', () => {
    const error = { code: 'P0001', message: 'Sorry, this listing is fully reserved.' }
    expect(explainError(error, '002_reservations.sql')).toBe(error)
  })
})
