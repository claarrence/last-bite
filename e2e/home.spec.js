import { test, expect } from '@playwright/test'

const baseListing = {
  owner_id: '44444444-4444-4444-8444-444444444444',
  status: 'open',
  description: '',
  pickup_start: new Date(Date.now() - 3600_000).toISOString(),
  pickup_end: new Date(Date.now() + 3600_000).toISOString(),
  dietary_tags: [],
  allergens: [],
}
const listings = [
  {
    ...baseListing,
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Buffet lunch boxes',
    listing_type: 'free',
    quantity_level: 'some',
    address: 'SMU, Bras Basah',
    photo_path: '/images/buffet.jpg',
  },
  {
    ...baseListing,
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Chicken rice sets',
    listing_type: 'discounted',
    price: 3.5,
    quantity_total: 8,
    address: 'Maxwell Food Centre',
    photo_path: '/images/meal.jpg',
  },
  {
    ...baseListing,
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Salad bowls',
    listing_type: 'discounted',
    price: 4,
    quantity_total: 6,
    address: 'Tanjong Pagar',
    photo_path: '/images/salad.jpg',
    pickup_end: new Date(Date.now() + 900_000).toISOString(),
  },
]

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/listings*', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id')?.replace('eq.', '')
    return route.fulfill({ json: id ? listings.find((listing) => listing.id === id) : listings })
  })
  await page.route('**/rest/v1/rpc/reserved_quantities', (route) => route.fulfill({ json: [] }))
})

test('search, food type and pickup sorting work together', async ({ page }) => {
  await page.goto('/#browse')
  const cards = page.getByTestId('listing-card')
  await expect(cards).toHaveCount(3)
  await page.getByRole('button', { name: 'Reservation food', exact: true }).click()
  await expect(cards).toHaveCount(2)
  await page.getByLabel('Search food or pickup location', { exact: true }).fill(' maxwell ')
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('Chicken rice sets')
  await page.getByLabel('Search food or pickup location', { exact: true }).clear()
  await page.getByLabel('Sort by', { exact: true }).selectOption('ending')
  await expect(cards.first()).toContainText('Salad bowls')
  await page.getByRole('button', { name: 'Free buffet', exact: true }).click()
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('Buffet lunch boxes')
  await page.getByLabel('Search food or pickup location', { exact: true }).fill('no match')
  await expect(page.getByRole('heading', { name: 'No matching food', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(cards).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'All food', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('link', { name: 'Salad bowls', exact: true }).click()
  await expect(page.getByTestId('listing-detail')).toContainText('Salad bowls')
})

test('expired food is excluded and a failed request can be retried', async ({ page }) => {
  let fail = true
  await page.route('**/rest/v1/listings*', (route) => {
    if (fail) return route.fulfill({ status: 500, json: { message: 'Temporarily unavailable' } })
    return route.fulfill({
      json: [
        ...listings,
        {
          ...listings[0],
          id: 'expired',
          title: 'Expired buffet',
          pickup_end: new Date(Date.now() - 1000).toISOString(),
        },
      ],
    })
  })
  await page.goto('/#browse')
  await expect(page.getByRole('alert')).toContainText('Temporarily unavailable')
  fail = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByTestId('listing-card')).toHaveCount(3)
  await expect(page.getByRole('link', { name: 'Expired buffet', exact: true })).toHaveCount(0)
})

test('the logo keeps the same typeface across pages', async ({ page }) => {
  await page.goto('/#browse')
  const homeStyle = await page.locator('.navbar-brand .brand-logo').evaluate((element) => {
    const style = getComputedStyle(element)
    return { family: style.fontFamily, weight: style.fontWeight, spacing: style.letterSpacing }
  })
  for (const path of ['/auth', `/listings/${listings[0].id}`]) {
    await page.goto(path)
    const otherStyle = await page
      .locator('[aria-label="Last Bite home"] .brand-logo')
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element)
        return { family: style.fontFamily, weight: style.fontWeight, spacing: style.letterSpacing }
      })
    expect(otherStyle).toEqual(homeStyle)
  }
})

for (const width of [375, 768, 1200]) {
  test(`homepage controls and food grid fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('listing-card')).toHaveCount(3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`home-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    })
    await page.getByLabel('Search food or pickup location', { exact: true }).fill('SMU')
    await expect(page.getByTestId('listing-card')).toHaveCount(1)
    await page.getByLabel('Search food or pickup location', { exact: true }).clear()
    await page.getByRole('button', { name: 'Free buffet', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('listing-card')).toHaveCount(1)
    await page.getByRole('link', { name: 'Buffet lunch boxes', exact: true }).click()
    await expect(page.getByTestId('listing-detail')).toBeVisible()
  })
}

test('the empty state links to posting without showing example listings', async ({
  page,
}, testInfo) => {
  await page.route('**/rest/v1/listings*', (route) => route.fulfill({ json: [] }))
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/#browse')
  await expect(
    page.getByRole('heading', { name: 'No food available right now', exact: true }),
  ).toBeVisible()
  await expect(page.getByTestId('listing-card')).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('home-empty-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.locator('.browse-empty').getByRole('link', { name: 'Post food', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\?redirect=\/listing-form$/)
})

test('nearest to me sorts food by distance from the user', async ({ page, context }) => {
  // The user stands at SMU; Maxwell Food Centre is roughly 2 km away.
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 1.2966, longitude: 103.8502 })
  const pinned = [
    { ...listings[0], lat: 1.2966, lng: 103.8502 },
    { ...listings[1], lat: 1.2803, lng: 103.8448 },
    { ...listings[2] }, // never pinned, so it goes last
  ]
  await page.route('**/rest/v1/listings*', (route) => route.fulfill({ json: pinned }))
  await page.goto('/#browse')
  const cards = page.getByTestId('listing-card')
  await expect(cards).toHaveCount(3)
  await page.getByLabel('Sort by', { exact: true }).selectOption('nearest')
  await expect(cards.first()).toContainText('Buffet lunch boxes')
  await expect(cards.first()).toContainText('0 m away')
  await expect(cards.nth(1)).toContainText('Chicken rice sets')
  await expect(cards.nth(1)).toContainText('km away')
  await expect(cards.nth(2)).toContainText('Salad bowls')
})

for (const width of [375, 1200]) {
  test(`View on map opens the food map at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('https://www.onemap.gov.sg/maps/tiles/**', (route) => route.abort())
    await page.route('**/rest/v1/listings*', (route) =>
      route.fulfill({ json: [{ ...listings[0], lat: 1.2966, lng: 103.8502 }, listings[1]] }),
    )
    await page.goto('/#browse')
    await page.getByRole('link', { name: 'View on map' }).click()
    await expect(page).toHaveURL(/\/map$/)
    await expect(page.getByRole('heading', { name: 'Food near you' })).toBeVisible()
    await expect(page.getByTestId('nearby-map')).toBeVisible()
    await expect(page.getByTestId('map-list-item')).toHaveCount(1)
    await expect(page.getByText('1 without a map location')).toBeVisible()
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    // "Back to list" returns to the browse section.
    await page.getByRole('button', { name: 'Back to list' }).click()
    await expect(page.getByRole('heading', { name: 'Browse food' })).toBeVisible()
  })
}

test('the map starts at any distance and keeps the chosen radius when location updates', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 1.2966, longitude: 103.8502 })
  await page.route('https://www.onemap.gov.sg/maps/tiles/**', (route) => route.abort())
  await page.route('**/rest/v1/listings*', (route) =>
    route.fulfill({
      json: [
        { ...listings[0], lat: 1.2966, lng: 103.8502 },
        { ...listings[1], lat: 1.2803, lng: 103.8448 },
      ],
    }),
  )
  await page.goto('/map')
  const distance = page.getByRole('combobox', { name: 'Distance', exact: true })
  await expect(page.getByRole('button', { name: 'Update location' })).toBeVisible()
  await expect(distance).toHaveValue('0')
  await expect(page.getByTestId('map-list-item')).toHaveCount(2)
  await distance.selectOption('1')
  await expect(page.getByTestId('map-list-item')).toHaveCount(1)
  await page.getByRole('button', { name: 'Update location' }).click()
  await expect(distance).toHaveValue('1')
  await distance.selectOption('0')
  await page.getByRole('button', { name: 'Update location' }).click()
  await expect(distance).toHaveValue('0')
  await expect(page.getByTestId('map-list-item')).toHaveCount(2)
})
