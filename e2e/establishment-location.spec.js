import { test, expect } from '@playwright/test'
import { session } from './helpers/session'

// Establishments choose a pickup location at registration; new listings start there.
// Supabase and OneMap responses are intercepted, so no real account or row is created.
const place = {
  BUILDING: 'REVENUE HOUSE',
  SEARCHVAL: 'REVENUE HOUSE',
  ADDRESS: '55 NEWTON ROAD REVENUE HOUSE SINGAPORE 307987',
  POSTAL: '307987',
  LATITUDE: '1.3197',
  LONGITUDE: '103.8426',
}

const mapEndpoint = /\/(?:api\/onemap|functions\/v1\/onemap)\?/

async function openRegisterForm(page) {
  await page.goto('/auth')
  await page.locator('label[for="mode-register"]').click()
  await page.getByText('Establishment', { exact: true }).click()
  await page.getByLabel('Establishment name', { exact: true }).fill('Test cafe')
  await page.getByLabel('Business email', { exact: true }).fill(session.user.email)
  await page.getByLabel('Establishment type', { exact: true }).selectOption('Restaurant')
}

test('new establishment listings start at the location saved at registration', async ({ page }) => {
  const profile = {
    name: 'Test cafe',
    address: place.ADDRESS,
    lat: Number(place.LATITUDE),
    lng: Number(place.LONGITUDE),
  }
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: session }))
  // .single() asks for one object; .maybeSingle() asks for a list.
  await page.route('**/rest/v1/establishment*', (route) =>
    route.fulfill({
      json: route.request().headers().accept?.includes('pgrst.object') ? profile : [profile],
    }),
  )
  await page.route('**/rest/v1/rpc/is_establishment', (route) => route.fulfill({ json: true }))
  await page.route('https://www.onemap.gov.sg/maps/tiles/**', (route) => route.abort())
  await page.goto('/auth?redirect=/listing-form')
  await page.getByText('Establishment', { exact: true }).click()
  await page.getByLabel('Business email', { exact: true }).fill(session.user.email)
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByTestId('listing-form')).toBeVisible()
  await expect(page.getByTestId('address')).toHaveValue(place.ADDRESS)
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1)
})

test('establishment registration saves the picked OneMap location', async ({ page }) => {
  let profile
  await page.route(mapEndpoint, (route) => route.fulfill({ json: { results: [place] } }))
  await page.route('**/auth/v1/signup', (route) => route.fulfill({ json: { user: session.user } }))
  await page.route('**/rest/v1/establishment*', (route) => {
    profile = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: profile })
  })
  await openRegisterForm(page)
  await page.getByLabel('Pickup location', { exact: true }).fill('307987')
  await page.getByTestId('address-results').getByRole('option').click()
  await expect(page.getByLabel('Pickup location', { exact: true })).toHaveValue(place.ADDRESS)
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect.poll(() => profile?.lat).toBe(Number(place.LATITUDE))
  expect(profile).toMatchObject({ address: place.ADDRESS, lng: Number(place.LONGITUDE) })
})

test('establishment registration requires a pickup location', async ({ page }) => {
  let signedUp = false
  await page.route('**/auth/v1/signup', (route) => {
    signedUp = true
    return route.fulfill({ json: { user: session.user } })
  })
  await openRegisterForm(page)
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByText('Enter your pickup location.')).toBeVisible()
  expect(signedUp).toBe(false)
})
