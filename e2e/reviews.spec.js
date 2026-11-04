import { test, expect } from '@playwright/test'
import { userId, session } from './helpers/session'

// Review journeys with intercepted Supabase responses: no real accounts or reviews
// are created. Eligibility and edit permissions are enforced by 003_reviews.sql.

const providerId = '44444444-4444-4444-8444-444444444444'
const otherCustomerId = '66666666-6666-4666-8666-666666666666'
const reservationId = '55555555-5555-4555-8555-555555555555'
const listingId = '33333333-3333-4333-8333-333333333333'

const collectedReservation = {
  id: reservationId,
  listing_id: listingId,
  customer_id: userId,
  quantity: 2,
  unit_price: 3.5,
  pickup_code: '482913',
  status: 'collected',
  created_at: new Date().toISOString(),
  listing: {
    id: listingId,
    owner_id: providerId,
    title: 'Chicken rice boxes',
    photo_path: '',
    address: 'Maxwell Food Centre',
    collection_instructions: '',
    pickup_start: new Date(Date.now() - 3 * 3600_000).toISOString(),
    pickup_end: new Date(Date.now() - 3600_000).toISOString(),
    status: 'open',
  },
}

function review(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    reservation_id: crypto.randomUUID(),
    listing_id: listingId,
    establishment_id: providerId,
    author_id: otherCustomerId,
    rating: 4,
    tags: [],
    comment: null,
    photo_path: '',
    reply: null,
    created_at: '2026-10-10T10:00:00Z',
    listing: { title: 'Chicken rice boxes' },
    ...overrides,
  }
}

async function logIn(page, redirect, establishment = false) {
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: session }))
  await page.route(`**/rest/v1/${establishment ? 'establishment' : 'normal_user'}*`, (route) =>
    route.fulfill({ json: { name: 'Test user' } }),
  )
  await page.goto(`/auth?redirect=${redirect}`)
  if (establishment) await page.getByText('Establishment', { exact: true }).click()
  await page
    .getByLabel(establishment ? 'Business email' : 'Email address', { exact: true })
    .fill(session.user.email)
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
}

async function mockProfile(page, profileId) {
  await page.route('**/rest/v1/rpc/establishment_profile', (route) =>
    route.fulfill({
      json: [{ id: profileId, name: 'Maxwell Chicken Rice', business_type: 'Hawker Stall' }],
    }),
  )
}

test('a customer reviews a collected order with stars, tags and a comment', async ({ page }) => {
  let saved = null
  await mockProfile(page, providerId)
  await page.route('**/rest/v1/reservations*', (route) =>
    route.fulfill({ json: [collectedReservation] }),
  )
  await page.route('**/rest/v1/reviews*', (route) => {
    if (route.request().method() === 'POST') {
      saved = { ...review(), ...route.request().postDataJSON(), author_id: userId }
      return route.fulfill({ status: 201, json: saved })
    }
    return route.fulfill({ json: saved ? [saved] : [] })
  })
  await logIn(page, `/reservations/${reservationId}/review`)
  await expect(page.getByTestId('review-form')).toBeVisible()

  // A rating is required; nothing is sent without one.
  await page.getByTestId('submit-review').click()
  await expect(page.getByText('Choose a star rating from 1 to 5.')).toBeVisible()
  expect(saved).toBeNull()

  // Mouse: click the 4th star. Keyboard: arrow right moves to 5 stars.
  await page.locator('label[for="review-rating-4"]').click()
  await expect(page.getByTestId('rating-text')).toHaveText('4 out of 5')
  await page.getByTestId('star-4').press('ArrowRight')
  await expect(page.getByTestId('rating-text')).toHaveText('5 out of 5')

  await page.locator('label[for="tag-Fresh"]').click()
  await page.locator('label[for="tag-Easy to find"]').click()
  await page.getByTestId('review-comment-input').fill('Still warm and easy to collect.')
  await page.getByTestId('submit-review').click()

  await expect(page).toHaveURL(new RegExp(`/establishments/${providerId}$`))
  expect(saved).toMatchObject({
    reservation_id: reservationId,
    listing_id: listingId,
    establishment_id: providerId,
    rating: 5,
    tags: ['Fresh', 'Easy to find'],
    comment: 'Still warm and easy to collect.',
  })
  await expect(page.getByTestId('average-rating')).toHaveText('5.0')
  await expect(page.getByTestId('review-count')).toHaveText('1 review')
  await expect(page.getByTestId('review-comment')).toHaveText('Still warm and easy to collect.')
})

test('the establishment page summarises and sorts reviews for visitors', async ({ page }) => {
  await mockProfile(page, providerId)
  await page.route('**/rest/v1/reviews*', (route) =>
    route.fulfill({
      json: [
        review({ rating: 3, comment: 'Newest, okay', created_at: '2026-10-12T10:00:00Z' }),
        review({
          rating: 5,
          comment: 'Middle, great',
          tags: ['Fresh'],
          created_at: '2026-10-08T10:00:00Z',
        }),
        review({
          rating: 4,
          comment: 'Oldest, good',
          tags: ['Fresh', 'Generous portion'],
          created_at: '2026-10-01T10:00:00Z',
        }),
      ],
    }),
  )
  await page.goto(`/establishments/${providerId}`)

  await expect(page.getByTestId('establishment-name')).toHaveText('Maxwell Chicken Rice')
  await expect(page.getByTestId('average-rating')).toHaveText('4.0')
  await expect(page.getByTestId('review-count')).toHaveText('3 reviews')
  await expect(page.getByTestId('top-tag').first()).toHaveText('Fresh · 2')

  const comments = page.getByTestId('review-comment')
  await expect(comments.first()).toHaveText('Newest, okay')
  await page.getByLabel('Sort by').selectOption('highest')
  await expect(comments).toHaveText(['Middle, great', 'Oldest, good', 'Newest, okay'])

  // Visitors cannot edit, delete or reply.
  await expect(page.getByTestId('edit-review-button')).toHaveCount(0)
  await expect(page.getByTestId('reply-button')).toHaveCount(0)
})

test('the provider replies publicly to a review', async ({ page }) => {
  let patch
  const original = review({ comment: 'Could be warmer' })
  await mockProfile(page, userId)
  await page.route('**/rest/v1/reviews*', (route) => {
    if (route.request().method() === 'PATCH') {
      patch = route.request().postDataJSON()
      return route.fulfill({ json: { ...original, ...patch, listing: undefined } })
    }
    return route.fulfill({ json: [{ ...original, establishment_id: userId }] })
  })
  await logIn(page, `/establishments/${userId}`, true)

  await page.getByTestId('reply-button').click()
  await page.getByTestId('reply-input').fill('  Thanks, we will pack it sooner.  ')
  await page.getByTestId('save-reply-button').click()
  await expect(page.getByTestId('review-reply')).toContainText('Thanks, we will pack it sooner.')
  expect(patch).toEqual({ reply: 'Thanks, we will pack it sooner.' })
  // Providers cannot change the customer's rating or comment.
  await expect(page.getByTestId('edit-review-button')).toHaveCount(0)
})

test('authors can delete their own review and the summary updates', async ({ page }) => {
  let deleted = false
  await mockProfile(page, providerId)
  await page.route('**/rest/v1/reviews*', (route) => {
    if (route.request().method() === 'DELETE') {
      deleted = true
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({ json: [review({ author_id: userId, comment: 'Mine' })] })
  })
  await logIn(page, `/establishments/${providerId}`)

  await expect(page.getByText('Your review')).toBeVisible()
  await page.getByTestId('delete-review-button').click()
  await page.getByTestId('confirm-dialog').getByTestId('confirm-button').click()
  await expect(page.getByTestId('no-reviews')).toBeVisible()
  await expect(page.getByTestId('review-count')).toHaveCount(0)
  expect(deleted).toBe(true)
})

test('My Reservations prompts for a review after collection', async ({ page }) => {
  await page.route('**/rest/v1/reservations*', (route) =>
    route.fulfill({ json: [collectedReservation] }),
  )
  await page.route('**/rest/v1/reviews*', (route) => route.fulfill({ json: [] }))
  await logIn(page, '/my-reservations')

  await expect(page.getByTestId('review-prompt')).toContainText('1 collected order to review')
  await page.getByRole('button', { name: 'Show collected orders' }).click()
  await page.getByTestId('review-link').click()
  await expect(page).toHaveURL(new RegExp(`/reservations/${reservationId}/review$`))
})
