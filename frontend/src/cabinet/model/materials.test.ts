import { describe, expect, it } from "vitest";
import { MAX_MATERIAL_BYTES, fileProblem, formatBytes, isLink, materialKind, titleFromFileName } from "./materials";

describe("materials", () => {
  it("тип по расширению, неизвестное — other", () => {
    expect(materialKind("Теория.PDF")).toBe("pdf");
    expect(materialKind("slides.pptx")).toBe("slides");
    expect(materialKind("scan.jpeg")).toBe("image");
    expect(materialKind("archive.zip")).toBe("other");
  });

  it("название из имени файла", () => {
    expect(titleFromFileName("logarifmy_teoriya-2.pdf")).toBe("logarifmy teoriya 2");
  });

  it("проверка файла: тип и размер", () => {
    expect(fileProblem({ name: "a.pdf", size: 100 })).toBeNull();
    expect(fileProblem({ name: "a.exe", size: 100 })).toBe("type");
    expect(fileProblem({ name: "a.pdf", size: MAX_MATERIAL_BYTES + 1 })).toBe("tooLarge");
  });

  it("ссылка — только http и https", () => {
    expect(isLink("https://youtu.be/x")).toBe(true);
    expect(isLink("javascript:alert(1)")).toBe(false);
    expect(isLink("просто текст")).toBe(false);
  });

  it("размер по-русски", () => {
    expect(formatBytes(512)).toBe("512 Б");
    expect(formatBytes(96_000)).toBe("94 КБ");
    expect(formatBytes(1_240_000)).toBe("1,2 МБ");
  });
});
