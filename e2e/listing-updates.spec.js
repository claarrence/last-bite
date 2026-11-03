import { test, expect } from '@playwright/test';

const normalUser = {
  email: process.env.E2E_USER_EMAIL,
  password: process.env.E2E_USER_PASSWORD,
}

async function login(page) {
  await page.goto('/auth')
  await page.getByRole('textbox', { name: 'Email address' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(normalUser.email);
  await page.getByLabel('Password', { exact: true }).fill(normalUser.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
}

// A valid 1x1 PNG, so no fixture file is needed.
const PHOTO = {
  name: 'food.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
}

const timeline = (page) => page.locator('[data-testid="update-timeline"] li')
const verifiedBadge = (page) => page.getByTestId('verified-badge')

// The radio inputs are visually hidden by Bootstrap's .btn-check, so click the label.
async function chooseStatus(page, status) {
  await page.locator(`label[for="status-${status}"]`).click()
}

async function postUpdate(page, status, file = PHOTO) {
  await chooseStatus(page, status)
  await page.getByTestId('update-photo').setInputFiles(file)
  await page.getByTestId('post-update').click()
}


test.describe('status updates (logged in)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/listings/140e6c6c-4d5b-4dbb-bef2-1224c267033f')
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
    const before = await timeline(page).count()

    await page.getByTestId('post-update').click()
    await expect(page.getByRole('alert')).toContainText('Choose a status.')

    await chooseStatus(page, 'still_available')
    await page.getByTestId('post-update').click()
    await expect(page.getByRole('alert')).toContainText('A photo is required.')

    await expect(timeline(page)).toHaveCount(before)
  })

  test('rejects a file that is not an image', async ({ page }) => {
    await page.getByTestId('update-photo').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a photo'),
    })
    await expect(page.getByRole('alert')).toContainText('Please choose an image file.')
  })

  test('posting "Still available" adds a timeline entry and the verified badge', async ({
    page,
  }) => {
    const before = await timeline(page).count()

    await postUpdate(page, 'still_available')

    await expect(timeline(page)).toHaveCount(before + 1)
    await expect(timeline(page).first()).toContainText('Still available')
    await expect(timeline(page).first()).toContainText('Just now')
    await expect(timeline(page).first().locator('img')).toBeVisible()
    await expect(verifiedBadge(page)).toBeVisible()
    // The form is ready for another post.
    await expect(page.getByTestId('post-update')).toHaveText('Post update')
  })

  test('the verified badge is still there after a reload (it comes from the database)', async ({
    page,
  }) => {
    await postUpdate(page, 'running_low')
    await expect(verifiedBadge(page)).toBeVisible()

    await page.reload()

    await expect(timeline(page).first()).toContainText('Still available')
    await expect(verifiedBadge(page)).toBeVisible()
  })

  test('posting "All gone" shows the banner and removes the badge', async ({ page }) => {
    await postUpdate(page, 'all_gone')

    await expect(timeline(page).first()).toContainText('All gone')
    await expect(page.getByText('reported this is all gone')).toBeVisible()
    await expect(verifiedBadge(page)).toBeHidden()
  })
})