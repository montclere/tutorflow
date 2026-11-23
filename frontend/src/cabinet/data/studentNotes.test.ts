import { beforeEach, describe, expect, it, vi } from "vitest";

let store: typeof import("./index");
beforeEach(async () => {
  vi.resetModules();
  store = await import("./index");
});

describe("STUDENT-NOTES-2: адресные изменения заметок", () => {
  it("назначает стабильные разные ID исходным записям без изменения фикстур", async () => {
    const { studentDetails } = await import("../mocks/studentDetails");
    const original = structuredClone(studentDetails.ivanov);
    const first = store.getStudentDetails("ivanov").notes;
    expect(first[0]?.id).toEqual(expect.any(String));
    expect(new Set(first.map((note) => note.id)).size).toBe(first.length);
    expect(store.getStudentDetails("ivanov").notes.map((note) => note.id)).toEqual(first.map((note) => note.id));
    expect(studentDetails.ivanov).toEqual(original);
  });

  it("добавляет новые записи одной даты первыми и сортирует даты по убыванию", () => {
    store.addNote("sokolov", { date: "2026-11-21", text: "Первая" });
    store.addNote("sokolov", { date: "2026-11-20", text: "Вчера" });
    store.addNote("sokolov", { date: "2026-11-21", text: "  Вторая  " });
    expect(store.getStudentDetails("sokolov").notes.map((note) => note.text)).toEqual(["Вторая", "Первая", "Вчера"]);
  });

  it("редактирует одну из одинаковых заметок, сохраняя ID/дату, и удаляет только выбранную", () => {
    const note = { date: "2026-11-21", text: "Одинаковые" };
    store.addNote("sokolov", note);
    store.addNote("sokolov", note);
    const [first, second] = store.getStudentDetails("sokolov").notes;
    expect(first!.id).not.toBe(second!.id);
    expect(store.updateNote("sokolov", first!.id, "  Изменена  ")).toBe(true);
    expect(store.getStudentDetails("sokolov").notes).toEqual([{ ...first, text: "Изменена" }, second]);
    expect(store.removeNote("sokolov", first!.id)).toBe(true);
    expect(store.getStudentDetails("sokolov").notes).toEqual([second]);
    expect(store.removeNote("sokolov", first!.id)).toBe(false);
  });

  it("меняет исходную заметку без потери других заметок, платежей или данных ученика", () => {
    const before = structuredClone(store.getStudentDetails("ivanov"));
    const student = structuredClone(store.getStudent("ivanov"));
    const first = before.notes[0]!;
    expect(store.updateNote("ivanov", first.id, "Правка")).toBe(true);
    expect(store.getStudentDetails("ivanov").notes[0]).toEqual({ ...first, text: "Правка" });
    expect(store.removeNote("ivanov", first.id)).toBe(true);
    expect(store.getStudentDetails("ivanov")).toEqual({ ...before, notes: before.notes.slice(1) });
    expect(store.getStudent("ivanov")).toEqual(student);
  });

  it("не меняет чужую, отсутствующую или невалидную запись", () => {
    const before = structuredClone(store.getStudentDetails("ivanov"));
    const id = before.notes[0]!.id;
    expect(store.updateNote("petrov", id, "Чужая")).toBe(false);
    expect(store.removeNote("petrov", id)).toBe(false);
    expect(store.updateNote("ivanov", "missing", "Текст")).toBe(false);
    expect(store.updateNote("ivanov", id, "  ")).toBe(false);
    expect(store.updateNote("ivanov", id, "я".repeat(2001))).toBe(false);
    expect(store.addNote("ivanov", { date: "2026-11-21", text: " " })).toBe(false);
    expect(store.addNote("ivanov", { date: "2026-11-21", text: "я".repeat(2001) })).toBe(false);
    expect(store.getStudentDetails("ivanov")).toEqual(before);
    expect(store.updateNote("ivanov", id, "я".repeat(2000))).toBe(true);
  });

  it("уведомляет существующую подписку только об успешных изменениях", () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribeStudents(listener);
    store.addNote("sokolov", { date: "2026-11-21", text: "Новая" });
    const id = store.getStudentDetails("sokolov").notes[0]!.id;
    store.updateNote("sokolov", id, "Правка");
    store.removeNote("sokolov", id);
    store.removeNote("sokolov", id);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(store.getStudentDetails("sokolov").notes).toEqual([]);
    unsubscribe();
  });
});
