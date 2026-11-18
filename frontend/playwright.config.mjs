import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: process.env.TUTORFLOW_TEST_WEB_URL, viewport: { width: 1280, height: 850 } },
})
