import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { landing } from "./src/content/landing.ru.ts";
import { htmlMeta } from "./vite/html-meta.ts";
import { objects3d } from "./vite/objects3d.ts";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    objects3d("public"),
    htmlMeta({
      TITLE: landing.meta.title,
      DESCRIPTION: landing.meta.description,
      OG_IMAGE_ALT: landing.meta.ogImageAlt,
    }),
  ],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
