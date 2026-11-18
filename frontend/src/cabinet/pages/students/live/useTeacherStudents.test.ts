import { describe, expect, it } from "vitest";
import type { TeacherCard } from "../../../api/students";
import { placeCard } from "./useTeacherStudents";

const card = (id: string, status: TeacherCard["status"] = "active"): TeacherCard => ({
  id,
  name: id,
  subject: null,
  goal: null,
  note: null,
  hasStudentAccount: false,
  status,
  createdAt: "",
  updatedAt: "",
  version: 1,
});

describe("placeCard", () => {
  it("переносит карточку в архив и обратно, наверх списка", () => {
    const data = { active: [card("a"), card("b")], archived: [card("c", "archived")], invitations: [] };
    const archived = placeCard(data, card("b", "archived"));
    expect(archived.active.map((item) => item.id)).toEqual(["a"]);
    expect(archived.archived.map((item) => item.id)).toEqual(["b", "c"]);
    expect(placeCard(archived, card("c")).active.map((item) => item.id)).toEqual(["c", "a"]);
  });
});
