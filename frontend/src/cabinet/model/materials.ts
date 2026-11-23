import type { MaterialKind } from "../mocks/types";

/** Файлы для ученика: теория, конспекты, презентации, картинки — до 20 МБ. */
export const MAX_MATERIAL_BYTES = 20 * 1024 * 1024;
export const MATERIAL_ACCEPT = ".pdf,.doc,.docx,.odt,.txt,.ppt,.pptx,.key,.png,.jpg,.jpeg,.webp,.gif";

const kindsByExtension: Record<string, MaterialKind> = {
  pdf: "pdf",
  doc: "doc",
  docx: "doc",
  odt: "doc",
  txt: "doc",
  ppt: "slides",
  pptx: "slides",
  key: "slides",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
};

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

export function materialKind(fileName: string): MaterialKind {
  return kindsByExtension[extensionOf(fileName)] ?? "other";
}

/** Название по умолчанию — имя файла без расширения. */
export function titleFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return (dot > 0 ? fileName.slice(0, dot) : fileName).replace(/[_-]+/g, " ").trim();
}

export type FileProblem = "tooLarge" | "type";

export function fileProblem(file: { name: string; size: number }): FileProblem | null {
  if (!(extensionOf(file.name) in kindsByExtension)) return "type";
  return file.size > MAX_MATERIAL_BYTES ? "tooLarge" : null;
}

export function isLink(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const KB = 1024;

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} Б`;
  if (bytes < KB * KB) return `${Math.round(bytes / KB)} КБ`;
  return `${(bytes / KB / KB).toFixed(1).replace(".", ",")} МБ`;
}
