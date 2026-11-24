import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: '.',
  use: { baseURL },
  webServer: {
    command: 'npm run preview',
    cwd: fileURLToPath(new URL('../../frontend/', import.meta.url)),
    url: baseURL,
  },
})
