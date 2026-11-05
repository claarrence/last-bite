import { test, expect } from '@playwright/test'

const listingId = '33333333-3333-4333-8333-333333333333'

test.beforeEach(async ({ page }) => {
  const listing = {
    id: listingId,
    owner_id: '44444444-4444-4444-8444-444444444444',
    listing_type: 'free',
    title: 'Available lunch boxes',
    photo_path: '',
    quantity_level: 'some',
    address: 'Singapore',
    pickup_start: new Date(Date.now() - 3600_000).toISOString(),
    pickup_end: new Date(Date.now() + 3600_000).toISOString(),
    dietary_tags: [],
    allergens: [],
    status: 'open',
  }
  await page.route('**/rest/v1/listings*', (route) =>
    route.fulfill({
      json: new URL(route.request().url()).searchParams.has('id') ? listing : [listing],
    }),
  )
  // Watch visible scroll positions from the first rendered frame after each full load.
  await page.addInitScript(() => {
    window.loadPositions = []
    let frames = 0
    function recordPosition() {
      if (document.querySelector('.home-page')) window.loadPositions.push(window.scrollY)
      frames++
      if (frames < 180) requestAnimationFrame(recordPosition)
    }
    requestAnimationFrame(recordPosition)
  })
})

for (const width of [375, 1200]) {
  test(`Browse loads and refreshes without a scroll sweep at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#browse')
    const heading = page.getByRole('heading', { name: 'Browse food', exact: true })
    await expect(heading).toBeVisible()
    await expect.poll(async () => Math.round((await heading.boundingBox()).y)).toBe(100)

    await page.reload()
    await expect(heading).toBeVisible()
    await expect.poll(async () => Math.round((await heading.boundingBox()).y)).toBe(100)
    // Sample more rendered frames: a smooth startup sweep would traverse many positions.
    const positions = await page.evaluate(async () => {
      for (let frame = 0; frame < 30; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }
      return [...new Set(window.loadPositions.filter((y) => y > 0).map(Math.round))]
    })
    expect(positions.length).toBeLessThanOrEqual(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test(`opening food and going back restores Browse at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#browse')
    const cardLink = page.getByRole('link', { name: 'Available lunch boxes', exact: true })
    await expect(cardLink).toBeVisible()
    await cardLink.scrollIntoViewIfNeeded()
    // Clicking a card can first bring it into view. Save the actual departure position.
    await page.evaluate(() => {
      document.addEventListener(
        'click',
        () => {
          window.departureY = window.scrollY
        },
        { once: true, capture: true },
      )
    })
    await cardLink.click()
    const previousY = await page.evaluate(() => window.departureY)
    await expect(page.getByTestId('listing-detail')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await page.goBack()
    await expect(cardLink).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(previousY)
  })

  test(`the logo returns home and replays the upward entrance at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/listings/${listingId}`)
    await page.locator('.navbar-brand').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('.home-hero')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

    const entrance = page.locator('.logo-arrival')
    await expect(entrance).toBeVisible()
    await entrance.evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    )
    await page.locator('.hero-logo-link').click()
    await expect
      .poll(() =>
        entrance.evaluate((element) =>
          element.getAnimations().some((animation) => animation.playState === 'running'),
        ),
      )
      .toBe(true)

    await page.locator('.hero-actions a', { hasText: 'Browse food' }).click()
    await expect.poll(() => page.evaluate(() => window.scrollY > 0)).toBe(true)
    await page.locator('.navbar-brand').click()
    await expect(page).toHaveURL(/\/$/)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await expect(page.getByTestId('action-feedback')).toHaveCount(0)
  })
}

test('the footer logo links home', async ({ page }) => {
  await page.goto('/auth')
  await page.locator('footer').getByRole('link', { name: 'Last Bite home', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.home-hero')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test('the logo works with the keyboard and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#browse')
  await page.locator('.navbar-brand').focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  expect(
    await page
      .locator('.home-hero')
      .evaluate((element) => element.getAnimations({ subtree: true }).length),
  ).toBe(0)
})

test('reduced-motion Browse navigation arrives directly at the food grid', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('link', { name: 'Browse food', exact: true }).first().click()
  const heading = page.getByRole('heading', { name: 'Browse food', exact: true })
  await expect.poll(async () => Math.round((await heading.boundingBox()).y)).toBe(100)
})

test('page reads wait quietly without loading messages or false empty states', async ({ page }) => {
  let finishRequest
  const pending = new Promise((resolve) => {
    finishRequest = resolve
  })
  await page.route('**/rest/v1/listings*', async (route) => {
    await pending
    await route.fulfill({ json: [] })
  })
  await page.goto('/#browse')
  await expect(page.locator('#browse')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByText(/loading|preparing/i)).toHaveCount(0)
  await expect(page.getByText('No food available right now')).toHaveCount(0)
  await expect(page.locator('.food-loader')).toHaveCount(0)
  await expect(page.getByTestId('action-feedback')).toHaveCount(0)
  finishRequest()
  await expect(page.locator('#browse')).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByText('No food available right now')).toBeVisible()
})
