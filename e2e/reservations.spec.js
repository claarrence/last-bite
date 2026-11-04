import { test, expect } from '@playwright/test'
import { userId, session } from './helpers/session'

// Reservation journeys with intercepted Supabase responses: no real accounts,
// listings or reservations are created. The stock, ownership and pickup-window
// rules themselves are enforced by the database functions in 002_reservations.sql.

const listingId = '33333333-3333-4333-8333-333333333333'
const providerId = '44444444-4444-4444-8444-444444444444'
const hour = 3600_000

function discountedListing(overrides = {}) {
  return {
    id: listingId,
    owner_id: providerId,
    listing_type: 'discounted',
    title: 'Chicken rice boxes',
    description: '',
    photo_path: '',
    price: 3.5,
    quantity_total: 8,
    quantity_level: null,
    address: 'Maxwell Food Centre, Stall 10',
    collection_instructions: 'Ask for Mr Tan at the counter',
    lat: null,
    lng: null,
    pickup_start: new Date(Date.now() - hour).toISOString(),
    pickup_end: new Date(Date.now() + 2 * hour).toISOString(),
    dietary_tags: [],
    allergens: [],
    status: 'open',
    ...overrides,
  }
}

function reservationFor(listing, overrides = {}) {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    listing_id: listing.id,
    customer_id: userId,
    quantity: 2,
    unit_price: 3.5,
    pickup_code: '482913',
    status: 'reserved',
    created_at: new Date().toISOString(),
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

test.describe('customer reserving discounted food', () => {
  const listing = discountedListing()
  let reserved

  test.beforeEach(async ({ page }) => {
    reserved = 3
    await page.route('**/rest/v1/listings*', (route) => route.fulfill({ json: listing }))
    await page.route('**/rest/v1/rpc/reserved_quantities', (route) =>
      route.fulfill({ json: [{ listing_id: listingId, reserved }] }),
    )
    await page.route('**/rest/v1/reservations*', (route) => route.fulfill({ json: [] }))
  })

  test('reserves portions and receives a pickup reference', async ({ page }) => {
    let sentBody
    let created = null
    await page.route('**/rest/v1/rpc/create_reservation', (route) => {
      sentBody = route.request().postDataJSON()
      reserved += sentBody.p_quantity
      created = reservationFor(listing, { quantity: sentBody.p_quantity })
      return route.fulfill({ json: created })
    })
    // Like the real database, the new booking is returned once it exists.
    await page.route('**/rest/v1/reservations*', (route) =>
      route.fulfill({ json: created ? [created] : [] }),
    )
    await logIn(page, `/listings/${listingId}`)

    await expect(page.getByTestId('detail-quantity')).toHaveText('5 of 8 portions left')

    // Asking for more than remain is stopped before any request is sent.
    await page.getByTestId('reserve-quantity').fill('6')
    await page.getByTestId('reserve-button').click()
    await expect(page.getByTestId('reserve-error')).toHaveText('Only 5 portions available.')
    expect(sentBody).toBeUndefined()

    await page.getByTestId('reserve-quantity').fill('2')
    await expect(page.getByTestId('reserve-button')).toContainText('S$7.00')
    await page.getByTestId('reserve-button').click()

    await expect(page.getByTestId('action-feedback')).toBeVisible()
    await expect(page.getByTestId('action-feedback')).toContainText('Reserving your portions…')
    await expect(page.getByTestId('reserve-button')).toBeDisabled()
    await expect(page.getByTestId('pickup-code')).toHaveText('482913')
    await expect(page.getByTestId('detail-quantity')).toHaveText('3 of 8 portions left')
    expect(sentBody).toEqual({ p_listing_id: listingId, p_quantity: 2 })
  })

  test('shows the database refusal and keeps the chosen quantity', async ({ page }) => {
    await page.route('**/rest/v1/rpc/create_reservation', (route) =>
      route.fulfill({
        status: 400,
        json: { code: 'P0001', message: 'Sorry, this listing is fully reserved.' },
      }),
    )
    await logIn(page, `/listings/${listingId}`)
    await page.getByTestId('reserve-quantity').fill('4')
    await page.getByTestId('reserve-button').click()
    await expect(page.getByTestId('reserve-error')).toHaveText(
      'Sorry, this listing is fully reserved.',
    )
    await expect(page.getByTestId('reserve-quantity')).toHaveValue('4')
  })

  test('visitors are asked to log in before reserving', async ({ page }) => {
    await page.goto(`/listings/${listingId}`)
    await page.getByRole('link', { name: 'Log in to reserve' }).click()
    await expect(page).toHaveURL(new RegExp(`/auth\\?redirect=.*${listingId}`))
  })
})

test('a fully reserved listing cannot be booked', async ({ page }) => {
  await page.route('**/rest/v1/listings*', (route) => route.fulfill({ json: discountedListing() }))
  await page.route('**/rest/v1/rpc/reserved_quantities', (route) =>
    route.fulfill({ json: [{ listing_id: listingId, reserved: 8 }] }),
  )
  await page.route('**/rest/v1/reservations*', (route) => route.fulfill({ json: [] }))
  await logIn(page, `/listings/${listingId}`)
  await expect(page.getByTestId('sold-out')).toBeVisible()
  await expect(page.getByTestId('reserve-button')).toHaveCount(0)
})

test('My Reservations changes the quantity and cancels a booking', async ({ page }) => {
  const listing = discountedListing()
  const booking = { ...reservationFor(listing), listing }
  const sent = []
  await page.route('**/rest/v1/reservations*', (route) => route.fulfill({ json: [booking] }))
  await page.route('**/rest/v1/reviews*', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/rpc/update_reservation_quantity', (route) => {
    sent.push(route.request().postDataJSON())
    return route.fulfill({ json: reservationFor(listing, { quantity: 3 }) })
  })
  await page.route('**/rest/v1/rpc/cancel_reservation', (route) =>
    route.fulfill({ json: reservationFor(listing, { quantity: 3, status: 'cancelled' }) }),
  )
  await logIn(page, '/my-reservations')

  const card = page.getByTestId('reservation-card')
  await expect(card.getByTestId('reservation-code')).toHaveText('482913')
  await expect(card.getByTestId('reservation-price')).toHaveText('2 × S$3.50 = S$7.00')
  await expect(card).toContainText('Ask for Mr Tan at the counter')

  await card.getByTestId('reservation-quantity').fill('3')
  await card.getByTestId('save-quantity-button').click()
  await expect(card.getByTestId('reservation-price')).toHaveText('3 × S$3.50 = S$10.50')
  expect(sent).toEqual([{ p_reservation_id: booking.id, p_quantity: 3 }])

  await card.getByTestId('cancel-reservation-button').click()
  await page.getByTestId('confirm-dialog').getByTestId('confirm-button').click()
  await expect(page.getByTestId('reservations-empty')).toBeVisible()
  await page.getByTestId('reservation-tab-cancelled').click()
  await expect(page.getByTestId('reservation-status')).toHaveText('Cancelled')
  // The booking stays in the history with its agreed price.
  await expect(page.getByTestId('reservation-price')).toHaveText('3 × S$3.50 = S$10.50')
})

test('explains what to do when the reservations table has not been created', async ({ page }) => {
  await page.route('**/rest/v1/reservations*', (route) =>
    route.fulfill({
      status: 404,
      json: { code: 'PGRST205', message: "Could not find the table 'public.reservations'" },
    }),
  )
  await logIn(page, '/my-reservations')
  await expect(page.getByRole('alert')).toHaveText(
    'This feature is not set up yet. Run supabase/migrations/002_reservations.sql in the Supabase SQL Editor.',
  )
})

test('the provider confirms a collection with the pickup reference', async ({ page }) => {
  const listing = discountedListing({ owner_id: userId })
  let sentBody
  await page.route('**/rest/v1/listings*', (route) => route.fulfill({ json: listing }))
  await page.route('**/rest/v1/rpc/reserved_quantities', (route) =>
    route.fulfill({ json: [{ listing_id: listingId, reserved: 2 }] }),
  )
  await page.route('**/rest/v1/reservations*', (route) =>
    route.fulfill({ json: [reservationFor(listing, { customer_id: providerId })] }),
  )
  await page.route('**/rest/v1/rpc/mark_reservation_collected', (route) => {
    sentBody = route.request().postDataJSON()
    return route.fulfill({
      json: reservationFor(listing, { customer_id: providerId, status: 'collected' }),
    })
  })
  await logIn(page, `/listings/${listingId}`, true)

  const panel = page.getByTestId('provider-reservations')
  await expect(panel.getByTestId('provider-reservation')).toContainText('482913')
  await expect(panel.getByTestId('provider-reservation')).toContainText('Reserved')
  // Providers cannot reserve their own food.
  await expect(page.getByTestId('reserve-panel')).toHaveCount(0)

  await expect(panel.getByTestId('mark-collected-button')).toBeDisabled()
  await panel.getByTestId('pickup-code-input').fill(' 482913 ')
  await panel.getByTestId('mark-collected-button').click()
  await expect(panel.getByTestId('provider-reservation')).toContainText('Collected')
  // The database compares references case-insensitively; the form trims spaces.
  expect(sentBody).toEqual({ p_listing_id: listingId, p_pickup_code: '482913' })
})

test('My Reservations requires login', async ({ page }) => {
  await page.goto('/my-reservations')
  await expect(page).toHaveURL(/\/auth\?redirect=\/my-reservations$/)
})

test('free food remains walk-in only', async ({ page }) => {
  await page.route('**/rest/v1/listings*', (route) =>
    route.fulfill({
      json: discountedListing({
        listing_type: 'free',
        price: null,
        quantity_total: null,
        quantity_level: 'some',
      }),
    }),
  )
  await page.goto(`/listings/${listingId}`)
  await expect(page.getByTestId('listing-detail')).toContainText('Free · Walk-in collection')
  await expect(page.getByTestId('reserve-panel')).toHaveCount(0)
})

test('expired bookings remain in history without change or cancel controls', async ({ page }) => {
  const listing = discountedListing({ pickup_end: new Date(Date.now() - hour).toISOString() })
  await page.route('**/rest/v1/reservations*', (route) =>
    route.fulfill({ json: [{ ...reservationFor(listing), listing }] }),
  )
  await logIn(page, '/my-reservations')
  await expect(page.getByTestId('reservations-empty')).toBeVisible()
  await page.getByTestId('reservation-tab-expired').click()
  await expect(page.getByTestId('reservation-status')).toHaveText('Expired')
  await expect(page.getByTestId('save-quantity-button')).toHaveCount(0)
  await expect(page.getByTestId('cancel-reservation-button')).toHaveCount(0)
})

for (const width of [375, 768, 1200]) {
  test(`browse, book and manage a reservation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const listing = discountedListing()
    let booking = null
    await page.route('**/rest/v1/listings*', (route) =>
      route.fulfill({
        json: new URL(route.request().url()).searchParams.has('id') ? listing : [listing],
      }),
    )
    await page.route('**/rest/v1/rpc/reserved_quantities', (route) =>
      route.fulfill({ json: [{ listing_id: listingId, reserved: booking?.quantity || 0 }] }),
    )
    await page.route('**/rest/v1/reservations*', (route) =>
      route.fulfill({ json: booking ? [{ ...booking, listing }] : [] }),
    )
    await page.route('**/rest/v1/rpc/create_reservation', (route) => {
      booking = reservationFor(listing, { quantity: route.request().postDataJSON().p_quantity })
      return route.fulfill({ json: booking })
    })
    await logIn(page, '/#browse')
    await page.getByRole('link', { name: listing.title, exact: true }).click()
    await expect(page.getByTestId('reserve-button')).toBeVisible()
    await page.getByRole('button', { name: 'One portion more' }).click()
    await page.getByTestId('reserve-button').click()
    await expect(page.getByTestId('pickup-code')).toHaveText('482913')
    await page.getByTestId('toast').getByRole('button', { name: 'Close' }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: testInfo.outputPath(`pickup-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    })

    await page.getByRole('link', { name: 'Change or cancel in My Reservations' }).click()
    await expect(page.getByTestId('reservation-price')).toHaveText('2 × S$3.50 = S$7.00')
    await expect(page.getByTestId('save-quantity-button')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`reservations-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    })
  })
}
