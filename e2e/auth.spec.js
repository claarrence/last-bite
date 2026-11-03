import { test, expect } from '@playwright/test'
import { user, userId, session } from './helpers/session'

for (const role of ['User', 'Establishment']) {
  const table = role === 'User' ? 'normal_user' : 'establishment'
  const emailLabel = role === 'User' ? 'Email address' : 'Business email'

  test(`${role} login checks the correct profile and redirects`, async ({ page }) => {
    let profileChecked = false
    await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: session }))
    await page.route(`**/rest/v1/${table}*`, (route) => {
      profileChecked = true
      return route.fulfill({ json: { name: 'Test account' } })
    })
    await page.goto('/auth')
    await page.getByText(role, { exact: true }).click()
    await page.getByLabel(emailLabel, { exact: true }).fill(user.email)
    await page.getByLabel('Password', { exact: true }).fill('test-password')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page).toHaveURL(role === 'User' ? /\/$/ : /\/establishment-dashboard$/)
    expect(profileChecked).toBe(true)
  })

  test(`${role} registration writes only its own profile fields`, async ({ page }) => {
    let profile
    await page.route('**/auth/v1/signup', (route) => route.fulfill({ json: { user } }))
    await page.route(`**/rest/v1/${table}*`, (route) => {
      profile = route.request().postDataJSON()
      return route.fulfill({ status: 201, json: profile })
    })
    await page.goto('/auth')
    await page.locator('label[for="mode-register"]').click()
    await page.getByText(role, { exact: true }).click()
    await page
      .getByLabel(role === 'User' ? 'Full name' : 'Establishment name', { exact: true })
      .fill('Test account')
    await page.getByLabel(emailLabel, { exact: true }).fill(user.email)
    // eslint-disable-next-line playwright/no-conditional-in-test -- this field exists only for establishments
    if (role === 'Establishment') {
      await page.getByLabel('Establishment type', { exact: true }).selectOption('Restaurant')
      await page.getByLabel('Pickup location', { exact: true }).fill('SMU, 81 Victoria Street')
    }
    await page.getByLabel('Password', { exact: true }).fill('test-password')
    await page.getByLabel('Confirm password', { exact: true }).fill('test-password')
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect
      .poll(() => profile)
      .toEqual(
        role === 'User'
          ? { id: userId, name: 'Test account' }
          : {
              id: userId,
              name: 'Test account',
              business_type: 'Restaurant',
              address: 'SMU, 81 Victoria Street',
              lat: null,
              lng: null,
            },
      )
  })
}

test('failed login remains on the form and does not query a profile', async ({ page }) => {
  let profileChecked = false
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 400,
      json: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
    }),
  )
  await page.route('**/rest/v1/normal_user*', (route) => {
    profileChecked = true
    return route.fulfill({ json: null })
  })
  const messages = []
  page.on('dialog', async (dialog) => {
    messages.push(dialog.message())
    await dialog.dismiss()
  })
  await page.goto('/auth')
  await page.getByLabel('Email address', { exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect.poll(() => messages.length).toBe(1)
  await expect(page).toHaveURL(/\/auth$/)
  expect(profileChecked).toBe(false)
})
