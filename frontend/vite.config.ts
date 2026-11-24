import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const proxy = { "/api/v1": process.env.TUTORFLOW_API_ORIGIN ?? "http://127.0.0.1:8000" };

export default defineConfig({
  server: { proxy },
  preview: { proxy },
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx"],
  },
});
