import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";
const apiURL = "http://127.0.0.1:8865";
const gracefulShutdown = { signal: "SIGTERM", timeout: 10_000 } as const;

export default defineConfig({
  testDir: ".",
  use: { baseURL },
  webServer: [
    {
      command: "uv run --directory backend --locked python -m tests.e2e_server",
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      url: `${apiURL}/health`,
      timeout: 120_000,
      gracefulShutdown,
    },
    {
      command: "npm run preview",
      cwd: fileURLToPath(new URL("../../frontend/", import.meta.url)),
      url: baseURL,
      env: { TUTORFLOW_API_ORIGIN: apiURL },
      gracefulShutdown,
    },
  ],
});
