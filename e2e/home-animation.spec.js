import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/listings*', (route) => route.fulfill({ json: [] }))
  // Count real GPU draws without exposing renderer internals in the application.
  await page.addInitScript(() => {
    window.drawCalls = 0
    for (const method of ['drawElements', 'drawArrays']) {
      const original = WebGL2RenderingContext.prototype[method]
      WebGL2RenderingContext.prototype[method] = function (...args) {
        window.drawCalls++
        return original.apply(this, args)
      }
    }
  })
})

async function openRenderedScene(page) {
  await page.goto('/')
  const scene = page.locator('.home-food-scene')
  await expect(scene).toHaveAttribute('data-renderer', 'webgl', { timeout: 15000 })
  return scene
}

async function stoppedDrawing(page) {
  return page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const before = window.drawCalls
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return window.drawCalls === before
  })
}

test('the 3D scene renders and animates on the canvas', async ({ page }) => {
  const scene = await openRenderedScene(page)
  const canvas = scene.locator('canvas')
  const firstFrame = await canvas.screenshot()
  await expect.poll(async () => !(await canvas.screenshot()).equals(firstFrame)).toBe(true)
  expect(await page.evaluate(() => window.drawCalls)).toBeGreaterThan(0)
})

test('rendering pauses offscreen and resumes on returning home', async ({ page }) => {
  const scene = await openRenderedScene(page)
  await expect(page.getByRole('button', { name: /homepage animation/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Browse food', exact: true }).first().click()
  await expect
    .poll(() => scene.evaluate((element) => element.getBoundingClientRect().bottom))
    .toBeLessThan(100)
  await expect.poll(() => stoppedDrawing(page)).toBe(true)
  await page.locator('.navbar-brand').click()
  await expect(scene).toHaveAttribute('data-renderer', 'webgl')
  const before = await page.evaluate(() => window.drawCalls)
  await expect.poll(() => page.evaluate(() => window.drawCalls)).toBeGreaterThan(before)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => stoppedDrawing(page)).toBe(true)
})

test('reduced motion keeps the rendered scene still and Browse usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const scene = await openRenderedScene(page)
  await expect.poll(() => stoppedDrawing(page)).toBe(true)
  const firstFrame = await scene.locator('canvas').screenshot()
  const bounds = await scene.boundingBox()
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.7)
  expect((await scene.locator('canvas').screenshot()).equals(firstFrame)).toBe(true)
  await page.getByRole('link', { name: 'Browse food', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Browse food', exact: true })).toBeVisible()
})

test('the homepage stays usable when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type.startsWith('webgl')) return null
      return original.call(this, type, ...args)
    }
  })
  await page.goto('/')
  await expect(page.locator('.food-fallback img')).toHaveCount(3)
  await expect(page.locator('.food-fallback')).toBeVisible()
  await page.getByRole('link', { name: 'Browse food', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'No food available right now' })).toBeVisible()
})

test('a lost graphics context falls back cleanly and can reload', async ({ page }) => {
  const scene = await openRenderedScene(page)
  await scene.locator('canvas').evaluate((canvas) => {
    canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()
  })
  await expect(scene).toHaveAttribute('data-renderer', 'fallback')
  await expect(page.locator('.food-fallback')).toBeVisible()
  await page.reload()
  await expect(scene).toHaveAttribute('data-renderer', 'webgl', { timeout: 15000 })
})
