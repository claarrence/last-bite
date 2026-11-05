import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config()
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 15000 },
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    baseURL: isCI ? 'http://localhost:4173' : 'http://localhost:5173',
    trace: 'on-first-retry',
    headless: isCI,
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
  ],
  webServer: {
    command: isCI ? 'pnpm build && pnpm preview' : 'pnpm dev',
    port: isCI ? 4173 : 5173,
    reuseExistingServer: !isCI,
  },
})
