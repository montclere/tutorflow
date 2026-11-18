import { describe, expect, it } from "vitest";
import { isValidEmail, validateProfile } from "./validation";

describe("почта", () => {
  it.each(["anna@mail.ru", "  anna.k@school.example.com  "])("принимает %s", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(["", "anna", "anna@", "anna@mail", "an na@mail.ru", "@mail.ru"])("отклоняет «%s»", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe("шаг «О себе»", () => {
  it("требует имя и хотя бы один предмет", () => {
    expect(validateProfile({ name: "   ", subjects: [] })).toEqual({
      name: "nameRequired",
      subjects: "subjectsRequired",
    });
  });

  it("принимает имя с одним предметом", () => {
    expect(validateProfile({ name: "Анна", subjects: ["math"] })).toEqual({});
  });
});
