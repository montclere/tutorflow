import { describe, expect, it } from "vitest";
import type { StudentMaterial } from "../mocks/types";
import { studentMaterialsView } from "./studentMaterials";

const material = (id: string, kind: StudentMaterial["kind"], extra: Partial<StudentMaterial> = {}): StudentMaterial => ({ id, kind, title: id, sentAt: "2026-11-14", openedAt: null, ...extra });
const source = [material("picture", "image", { openedAt: "2026-11-15" }), material("pdf", "pdf", { title: "Н и НН: правила", note: "Прочитай страницы 2–4", fileName: "teoriya.pdf" }), material("link", "link", { title: "Разбор", url: "https://example.test/" }), material("doc", "doc", { title: "Конспект" })];

describe("STUDENT-MATERIALS-UI-2: представление материалов", () => {
  it("сохраняет порядок, выделяет первую PDF, считает новые во всей подборке", () => {
    const result = studentMaterialsView(source, "all", "");
    expect(result.shown.map(item => item.id)).toEqual(["picture", "pdf", "link", "doc"]);
    expect(result.featuredId).toBe("pdf");
    expect(result.unread).toBe(3);
    expect(source.map(item => item.id)).toEqual(["picture", "pdf", "link", "doc"]);
  });
  it("совмещает тип и поиск, не меняет общий счётчик новых", () => {
    const result = studentMaterialsView(source, "pdf", " ПРАВИЛА ");
    expect(result.shown.map(item => item.id)).toEqual(["pdf"]);
    expect(result.unread).toBe(3);
    expect(studentMaterialsView(source, "image", "ПРАВИЛА").shown).toEqual([]);
  });
  it("ищет по комментарию, имени файла и ё/е", () => {
    expect(studentMaterialsView(source, "all", "страницы").shown.map(item => item.id)).toEqual(["pdf"]);
    expect(studentMaterialsView(source, "all", "teoriya").shown.map(item => item.id)).toEqual(["pdf"]);
    expect(studentMaterialsView([material("one", "doc", { title: "Разбор: всё о теме" })], "all", "ВСЕ").shown).toHaveLength(1);
  });
  it("сохраняет дополнительные типы и не дублирует основные фильтры", () => {
    expect(studentMaterialsView([...source, material("slides", "slides"), material("other", "other")], "all", "").filters).toEqual(["all", "pdf", "image", "link", "doc", "slides", "other"]);
    expect(studentMaterialsView(source, "doc", "").shown.map(item => item.id)).toEqual(["doc"]);
  });
  it("не выдумывает материалы при пустой подборке и отсутствии совпадений", () => {
    expect(studentMaterialsView([], "all", "")).toEqual({ shown: [], featuredId: null, unread: 0, filters: ["all", "pdf", "image", "link"] });
    expect(studentMaterialsView(source, "all", "несуществующий").featuredId).toBeNull();
  });
});
