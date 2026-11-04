import { test, expect } from '@playwright/test'

const hour = 3600_000
const baseListing = {
  owner_id: '44444444-4444-4444-8444-444444444444',
  status: 'open',
  description: '',
  pickup_start: new Date(Date.now() - hour).toISOString(),
  pickup_end: new Date(Date.now() + 3 * hour).toISOString(),
  allergens: [],
  photo_path: '/images/meal.jpg',
}
const listings = [
  {
    ...baseListing,
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Nasi lemak packs',
    listing_type: 'free',
    quantity_level: 'some',
    address: 'SMU School of Economics',
    dietary_tags: ['Halal'],
    lat: 1.2966,
    lng: 103.8502,
  },
  {
    ...baseListing,
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Veg curry sets',
    listing_type: 'discounted',
    price: 3,
    quantity_total: 8,
    address: 'Maxwell Food Centre',
    dietary_tags: ['Halal', 'Vegetarian'],
    pickup_end: new Date(Date.now() + hour).toISOString(), // ends soonest
    lat: 1.2803,
    lng: 103.8448,
  },
  {
    ...baseListing,
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Char siu rice',
    listing_type: 'free',
    quantity_level: 'few',
    address: 'Tanjong Pagar',
    dietary_tags: [],
    pickup_start: new Date(Date.now() + hour).toISOString(), // not open for collection yet
    lat: 1.2764,
    lng: 103.8458,
  },
]

const cards = (page) => page.getByTestId('listing-card')
const chips = (page) =>
  page.getByTestId('active-filters').getByRole('button', { name: /^Remove filter/ })
const dietary = (page, tag) => page.getByLabel(tag, { exact: true })

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/listings*', (route) => route.fulfill({ json: listings }))
  await page.route('**/rest/v1/rpc/reserved_quantities', (route) => route.fulfill({ json: [] }))
  await page.route('https://www.onemap.gov.sg/maps/tiles/**', (route) => route.abort())
})

test('dietary and "Available now" filters narrow the list and show removable tags', async ({
  page,
}) => {
  await page.goto('/#browse')
  await expect(cards(page)).toHaveCount(3)
  await expect(page.getByTestId('active-filters')).toHaveCount(0)

  await dietary(page, 'Halal').check()
  await expect(cards(page)).toHaveCount(2)
  await dietary(page, 'Vegetarian').check()
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('Veg curry sets')
  await expect(chips(page)).toHaveText([/Halal/, /Vegetarian/])

  // Removing one tag unticks only that option.
  await page.getByRole('button', { name: 'Remove filter: Vegetarian' }).click()
  await expect(dietary(page, 'Vegetarian')).not.toBeChecked()
  await expect(dietary(page, 'Halal')).toBeChecked()
  await expect(cards(page)).toHaveCount(2)

  await page.getByRole('checkbox', { name: 'Available now' }).check()
  await page.getByRole('button', { name: 'Free buffet', exact: true }).click()
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('Nasi lemak packs')
  await expect(chips(page)).toHaveText([/Free buffet/, /Halal/, /Available now/])

  await page.getByRole('button', { name: 'Clear all', exact: true }).click()
  await expect(page.getByTestId('active-filters')).toHaveCount(0)
  await expect(cards(page)).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'All food', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('filters chosen on Browse carry over to the map and back', async ({ page }) => {
  await page.goto('/#browse')
  await dietary(page, 'Halal').check()
  await page.getByLabel('Search food or pickup location', { exact: true }).fill('nasi')
  await expect(cards(page)).toHaveCount(1)

  await page.getByRole('link', { name: 'View on map' }).click()
  await expect(page).toHaveURL(/\/map$/)
  await expect(dietary(page, 'Halal')).toBeChecked()
  await expect(chips(page)).toHaveText([/nasi/, /Halal/])
  await expect(page.getByTestId('map-list-item')).toHaveCount(1)
  await expect(page.getByTestId('map-list-item')).toContainText('Nasi lemak packs')
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1)

  // Change the filters on the map, then check Browse sees the change.
  await page.getByRole('button', { name: 'Remove filter: nasi' }).click()
  await expect(page.getByTestId('map-list-item')).toHaveCount(2)
  await page.getByRole('button', { name: 'Back to list' }).click()
  await expect(page.getByLabel('Search food or pickup location', { exact: true })).toHaveValue('')
  await expect(dietary(page, 'Halal')).toBeChecked()
  await expect(cards(page)).toHaveCount(2)
})

test('the map list can be sorted by pickup deadline', async ({ page }) => {
  await page.goto('/map')
  const items = page.getByTestId('map-list-item')
  await expect(items).toHaveCount(3)
  await page.getByLabel('Sort map list').selectOption('ending')
  await expect(items.first()).toContainText('Veg curry sets')
})

test('the map says when filters hide everything and can clear them', async ({ page }) => {
  await page.goto('/map')
  await dietary(page, 'Vegan').check()
  await expect(page.getByTestId('map-list-item')).toHaveCount(0)
  await expect(page.getByText('No matching food on the map right now.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(page.getByTestId('map-list-item')).toHaveCount(3)
})

test('filters are remembered after a page refresh', async ({ page }) => {
  await page.goto('/#browse')
  await dietary(page, 'Halal').check()
  await page.getByRole('checkbox', { name: 'Available now' }).check()
  await expect(cards(page)).toHaveCount(2)

  await page.reload()
  await expect(dietary(page, 'Halal')).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Available now' })).toBeChecked()
  await expect(cards(page)).toHaveCount(2)
})

for (const width of [375, 1200]) {
  test(`filter checkboxes and tags fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#browse')
    await page.getByRole('checkbox', { name: 'Available now' }).check()
    for (const tag of ['Halal', 'Vegetarian', 'Vegan', 'No pork/no lard']) {
      await dietary(page, tag).check()
    }
    await expect(chips(page)).toHaveCount(5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByTestId('active-filters').screenshot({
      path: testInfo.outputPath(`filters-${width}.png`),
    })

    await page.goto('/map')
    await expect(chips(page)).toHaveCount(5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
