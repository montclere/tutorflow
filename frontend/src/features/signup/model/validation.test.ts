import { describe, expect, it } from "vitest";
import { hasErrors, isValidContact, isValidEmail, isValidPhone, normalizePhone, toContact, validateProfile } from "./validation";

describe("контакт", () => {
  it("почта проверяется синтаксически", () => {
    expect(isValidEmail("anna@mail.ru")).toBe(true);
    expect(isValidEmail(" anna@mail.ru ")).toBe(true);
    expect(isValidEmail("anna@mail")).toBe(false);
  });

  it("телефон — международный формат с «+», пробелы и скобки не мешают", () => {
    expect(normalizePhone("+7 (999) 123-45-67")).toBe("+79991234567");
    expect(isValidPhone("+7 999 123 45 67")).toBe(true);
    expect(isValidPhone("89991234567")).toBe(false);
  });

  it("без явного типа определяет почту по «@»", () => {
    expect(toContact(" anna@mail.ru ")).toEqual({ type: "email", value: "anna@mail.ru" });
    expect(toContact("+7 999 123-45-67")).toEqual({ type: "phone", value: "+79991234567" });
    expect(isValidContact(toContact("+7 999 123-45-67"))).toBe(true);
  });
});

describe("профиль", () => {
  it("требует имя и пароль от 15 символов", () => {
    expect(validateProfile({ name: " ", password: "короткий" })).toEqual({ name: "nameRequired", password: "passwordLength" });
    expect(validateProfile({ name: "Анна", password: "длинная фраза для входа" })).toEqual({});
    expect(hasErrors(validateProfile({ name: "Анна", password: "длинная фраза для входа" }))).toBe(false);
  });
});
