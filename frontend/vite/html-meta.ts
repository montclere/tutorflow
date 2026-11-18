import type { Plugin } from "vite";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export function htmlMeta(values: Record<string, string>): Plugin {
  return {
    name: "html-meta",
    transformIndexHtml: (html) =>
      html.replace(/%META_(\w+)%/g, (match, key: string) => {
        const value = values[key];
        if (value === undefined) throw new Error(`index.html: нет значения для ${match}`);
        return escapeHtml(value);
      }),
  };
}
