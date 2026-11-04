import { Buffer } from 'node:buffer'
import { test, expect } from '@playwright/test'
import { session } from './helpers/session'

const listingId = '33333333-3333-4333-8333-333333333333'
const PHOTO = {
  name: 'food.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
}
const timeline = (page) => page.getByTestId('update-timeline').locator('li')
const verifiedBadge = (page) => page.getByTestId('verified-badge')

async function chooseStatus(page, status) {
  await page.locator(`label[for="status-${status}"]`).click()
}

async function postUpdate(page, status, file = PHOTO) {
  await chooseStatus(page, status)
  await page.getByTestId('update-photo').setInputFiles(file)
  await page.getByTestId('post-update').click()
}

// Every test has its own in-memory responses. No real account, upload or row is changed.
test.beforeEach(async ({ page }) => {
  const listing = {
    id: listingId,
    owner_id: '44444444-4444-4444-8444-444444444444',
    listing_type: 'free',
    title: 'Available buffet food',
    photo_path: '',
    quantity_level: 'some',
    address: 'Singapore',
    pickup_start: new Date(Date.now() - 3600_000).toISOString(),
    pickup_end: new Date(Date.now() + 3600_000).toISOString(),
    dietary_tags: [],
    allergens: [],
    status: 'open',
  }
  const updates = []
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }))
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: session }))
  await page.route('**/rest/v1/normal_user*', (route) =>
    route.fulfill({ json: { name: 'Test user' } }),
  )
  await page.route('**/rest/v1/listings*', (route) => route.fulfill({ json: listing }))
  await page.route('**/rest/v1/listing_updates*', (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: updates })
    const created = {
      ...route.request().postDataJSON(),
      id: `update-${updates.length + 1}`,
      created_at: new Date().toISOString(),
    }
    updates.unshift(created)
    return route.fulfill({ status: 201, json: created })
  })
  await page.route('**/storage/v1/**', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ json: { Key: 'listing-update-photos/food.png' } })
      : route.fulfill({ contentType: 'image/png', body: PHOTO.buffer }),
  )

  await page.goto(`/auth?redirect=/listings/${listingId}`)
  await page.getByLabel('Email address', { exact: true }).fill(session.user.email)
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByTestId('listing-detail')).toBeVisible()
  await expect(page.getByTestId('status-updates')).toBeVisible()
})

test('shows the three status choices and a required photo field', async ({ page }) => {
  await expect(page.locator('label[for="status-still_available"]')).toHaveText('Still available')
  await expect(page.locator('label[for="status-running_low"]')).toHaveText('Running low')
  await expect(page.locator('label[for="status-all_gone"]')).toHaveText('All gone')
  await expect(page.getByTestId('update-photo')).toBeVisible()
})

test('asks for a status, then a photo, before posting', async ({ page }) => {
  await page.getByTestId('post-update').click()
  await expect(page.getByRole('alert')).toContainText('Choose a status.')
  await chooseStatus(page, 'still_available')
  await page.getByTestId('post-update').click()
  await expect(page.getByRole('alert')).toContainText('A photo is required.')
  await expect(timeline(page)).toHaveCount(0)
})

test('rejects a file that is not an image', async ({ page }) => {
  await page.getByTestId('update-photo').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a photo'),
  })
  await expect(page.getByRole('alert')).toContainText('Please choose an image file.')
})

test('posting Still available adds a timeline entry and the verified badge', async ({ page }) => {
  await postUpdate(page, 'still_available')
  await expect(timeline(page)).toHaveCount(1)
  await expect(timeline(page).first()).toContainText('Still available')
  await expect(timeline(page).first()).toContainText('Just now')
  await expect(timeline(page).first().locator('img')).toBeVisible()
  await expect(verifiedBadge(page)).toBeVisible()
  await expect(page.getByTestId('post-update')).toHaveText('Post update')
})

test('Running low and its verified badge survive a reload', async ({ page }) => {
  await postUpdate(page, 'running_low')
  await expect(verifiedBadge(page)).toBeVisible()
  await page.reload()
  await expect(timeline(page).first()).toContainText('Running low')
  await expect(verifiedBadge(page)).toBeVisible()
})

test('posting All gone shows the banner and removes the badge', async ({ page }) => {
  await postUpdate(page, 'all_gone')
  await expect(timeline(page).first()).toContainText('All gone')
  await expect(page.getByText('reported this is all gone')).toBeVisible()
  await expect(verifiedBadge(page)).toBeHidden()
})

test('a failed update preserves the chosen photo and status for retry', async ({ page }) => {
  await page.route('**/rest/v1/listing_updates*', (route) =>
    route.fulfill({ status: 500, json: { message: 'Please try again.' } }),
  )
  await postUpdate(page, 'running_low')
  await expect(page.getByRole('alert')).toContainText('Please try again.')
  await expect(page.getByTestId('status-running_low')).toBeChecked()
  await expect(page.getByAltText('Preview of your photo')).toBeVisible()
  await expect(page.getByTestId('post-update')).toBeEnabled()
})
