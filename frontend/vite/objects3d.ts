import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const moduleId = "virtual:objects-3d";
const resolvedId = `\0${moduleId}`;

// Список готовых картинок собирается при сборке, чтобы Object3D не запрашивал
// отсутствующие файлы и не получал 404 в браузере.
export function objects3d(publicDir: string): Plugin {
  const folder = resolve(publicDir, "3d");
  return {
    name: "objects-3d",
    resolveId: (id) => (id === moduleId ? resolvedId : undefined),
    load(id) {
      if (id !== resolvedId) return undefined;
      const names = readdirSync(folder)
        .filter((file) => file.endsWith(".webp"))
        .map((file) => file.slice(0, -".webp".length));
      return `export default ${JSON.stringify(names)};`;
    },
  };
}
