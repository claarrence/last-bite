import { test, expect } from '@playwright/test'
import { session } from './helpers/session'

async function openForm(page, establishment = false) {
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: session }))
  await page.route(`**/rest/v1/${establishment ? 'establishment' : 'normal_user'}*`, (route) =>
    route.fulfill({ json: { name: 'Test provider' } }),
  )
  await page.route('**/rest/v1/rpc/is_establishment', (route) =>
    route.fulfill({ json: establishment }),
  )
  await page.route('https://www.onemap.gov.sg/**', (route) => route.abort())
  await page.goto('/auth?redirect=/listing-form')
  if (establishment) await page.getByText('Establishment', { exact: true }).click()
  await page
    .getByLabel(establishment ? 'Business email' : 'Email address', { exact: true })
    .fill(session.user.email)
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByTestId('listing-form')).toBeVisible()
}

async function fillPickup(page) {
  await page.getByTestId('address').fill('SMU, Level 2, outside seminar room')
  await page.getByTestId('date').fill(new Date(Date.now() + 86400_000).toISOString().slice(0, 10))
  await page.getByTestId('start').fill('18:17')
  await page.getByTestId('end').fill('20:43')
}

for (const width of [375, 768, 1200]) {
  test(`establishment can choose buffet or reservation food at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await openForm(page, true)
    await expect(page.getByTestId('type-discounted')).toBeChecked()
    await expect(page.getByTestId('discounted-fields')).toBeVisible()
    await page.getByTestId('title').fill('Surplus lunch boxes')
    await page.getByTestId('price').fill('3.50')
    await page.getByTestId('quantity').fill('8')
    const preview = page.getByTestId('preview')
    await expect(preview.getByTestId('card-title')).toHaveText('Surplus lunch boxes')
    await expect(preview.getByTestId('card-price')).toHaveText('S$3.50')
    await expect(preview.getByTestId('card-quantity')).toHaveText('8 portions')

    await page.locator('label[for="type-free"]').click()
    await expect(page.getByTestId('free-fields')).toBeVisible()
    await expect(page.getByTestId('discounted-fields')).toHaveCount(0)
    await page.locator('label[for="qty-some"]').click()
    await expect(preview.getByTestId('card-price')).toHaveText('Free')

    await page.locator('label[for="type-discounted"]').click()
    await expect(page.getByTestId('price')).toHaveValue(/^3\.50?$/)
    await expect(page.getByTestId('quantity')).toHaveValue('8')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: testInfo.outputPath(`post-food-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    })
  })
}

test('a normal user only sees buffet food and can post it', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 })
  let payload
  await page.route('**/rest/v1/listings*', (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] })
    payload = route.request().postDataJSON()
    return route.fulfill({ json: { ...payload, id: '22222222-2222-4222-8222-222222222222' } })
  })
  await openForm(page)
  await expect(page.getByText('Buffet / Event food', { exact: true })).toBeVisible()
  await expect(page.getByTestId('type-discounted')).toHaveCount(0)
  await expect(page.getByText('Reservation food', { exact: true })).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('buffet-only-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByTestId('title').fill('Buffet leftovers')
  await page.locator('label[for="qty-some"]').click()
  await fillPickup(page)
  await page.getByTestId('submit').click()
  await expect(page.getByTestId('action-feedback')).toBeVisible()
  await expect(page.getByTestId('action-feedback')).toContainText('Posting your food…')
  await expect(page.getByTestId('submit')).toBeDisabled()
  await expect(page).toHaveURL(/\/$/)
  expect(payload).toMatchObject({
    listing_type: 'free',
    price: null,
    quantity_total: null,
    quantity_level: 'some',
    photo_path: '',
  })
})

test('failed reservation-food posting preserves entered details and allows retry', async ({
  page,
}) => {
  let payload
  let rejectSave = true
  await page.route('**/rest/v1/listings*', (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] })
    payload = route.request().postDataJSON()
    if (rejectSave) return route.fulfill({ status: 400, json: { message: 'Please try again.' } })
    return route.fulfill({ json: { ...payload, id: '22222222-2222-4222-8222-222222222222' } })
  })
  await openForm(page, true)
  await page.getByTestId('submit').click()
  await expect(page.getByTestId('form-errors')).toBeVisible()
  await page.getByTestId('title').fill('Chicken rice boxes')
  await page.getByTestId('price').fill('3.50')
  await page.getByTestId('quantity').fill('8')
  await fillPickup(page)
  await page.getByTestId('submit').click()
  await expect(page.getByTestId('toast')).toContainText('Please try again.')
  await expect(page.getByTestId('title')).toHaveValue('Chicken rice boxes')
  await expect(page.getByTestId('price')).toHaveValue(/^3\.50?$/)
  expect(payload).toMatchObject({
    listing_type: 'discounted',
    price: 3.5,
    quantity_total: 8,
    quantity_level: null,
  })
  rejectSave = false
  await page.getByTestId('submit').click()
  await expect(page).toHaveURL(/\/$/)
})

test('a selected pickup location survives posting, viewing and editing', async ({ page }) => {
  let saved
  await page.route('**/rest/v1/listings*', (route) => {
    if (route.request().method() === 'POST') {
      saved = {
        ...route.request().postDataJSON(),
        id: '22222222-2222-4222-8222-222222222222',
        owner_id: session.user.id,
        status: 'open',
      }
      return route.fulfill({ json: saved })
    }
    const single = new URL(route.request().url()).searchParams.has('id')
    return route.fulfill({ json: single ? saved : saved ? [saved] : [] })
  })
  await page.route(/\/(?:api\/onemap|functions\/v1\/onemap)\?/, (route) =>
    route.fulfill({
      json: {
        results: [
          {
            BUILDING: 'REVENUE HOUSE',
            SEARCHVAL: 'REVENUE HOUSE',
            ADDRESS: '55 NEWTON ROAD REVENUE HOUSE SINGAPORE 307987',
            POSTAL: '307987',
            LATITUDE: '1.3197',
            LONGITUDE: '103.8426',
          },
        ],
      },
    }),
  )
  await openForm(page)
  await page.getByTestId('title').fill('Lunch at Revenue House')
  await page.locator('label[for="qty-some"]').click()
  await fillPickup(page)
  await page.getByTestId('address').fill('307987')
  await expect(page.getByRole('option')).toBeVisible()
  await page.getByTestId('address').press('ArrowDown')
  await page.getByTestId('address').press('Enter')
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1)

  await page.getByTestId('submit').click()
  await expect(page).toHaveURL(/\/$/)
  expect(saved).toMatchObject({ lat: 1.3197, lng: 103.8426 })
  await page.getByRole('link', { name: saved.title, exact: true }).click()
  await expect(page.getByTestId('detail-map')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Get directions' })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/dir/?api=1&destination=1.3197,103.8426',
  )
  await page.getByTestId('edit-button').click()
  await expect(page.getByTestId('address')).toHaveValue(saved.address)
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1)
})
