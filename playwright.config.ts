import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'on-first-retry' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
  projects: [
    { name:'desktop', use:{ ...devices['Desktop Chrome'] } },
    { name:'ipad', use:{ ...devices['iPad Pro 11'] } },
    { name:'mobile', use:{ ...devices['Pixel 7'] } }
  ]
})
