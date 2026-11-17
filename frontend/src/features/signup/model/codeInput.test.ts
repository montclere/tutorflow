import { describe, expect, it } from "vitest";
import { backspaceTarget, emptyCode, enterDigits, isComplete, pasteCode } from "./codeInput";

const code = (value: string) => value.split("").map((char) => (char === "_" ? "" : char));

describe("ввод цифры", () => {
  it("записывает цифру и переносит фокус в следующее поле", () => {
    expect(enterDigits(emptyCode(), 0, "4")).toEqual({ digits: code("4_____"), focus: 1 });
  });

  it("в последнем поле оставляет фокус на месте", () => {
    expect(enterDigits(code("12345_"), 5, "6")).toEqual({ digits: code("123456"), focus: 5 });
  });

  it("заменяет цифру в заполненном поле последней введённой", () => {
    expect(enterDigits(code("1_____"), 0, "17")).toEqual({ digits: code("7_____"), focus: 1 });
  });

  it("игнорирует буквы и символы", () => {
    expect(enterDigits(code("1_____"), 1, "a")).toBeNull();
    expect(enterDigits(code("1_____"), 1, " -")).toBeNull();
  });

  it("очищает поле при удалении цифры", () => {
    expect(enterDigits(code("12____"), 1, "")).toEqual({ digits: code("1_____"), focus: 1 });
  });

  it("раскладывает по полям код, автозаполненный в одно поле", () => {
    expect(enterDigits(emptyCode(), 0, "654321")).toEqual({ digits: code("654321"), focus: 5 });
  });
});

describe("Backspace", () => {
  it("в пустом поле переводит фокус в предыдущее", () => {
    expect(backspaceTarget(code("12____"), 2)).toBe(1);
  });

  it("в заполненном поле не двигает фокус", () => {
    expect(backspaceTarget(code("123___"), 2)).toBeNull();
  });

  it("в первом поле не двигает фокус", () => {
    expect(backspaceTarget(emptyCode(), 0)).toBeNull();
  });
});

describe("вставка из буфера", () => {
  it("заполняет все поля и ставит фокус в последнее", () => {
    expect(pasteCode(emptyCode(), "123456")).toEqual({ digits: code("123456"), focus: 5 });
  });

  it("берёт только цифры и не больше шести", () => {
    expect(pasteCode(emptyCode(), "12-34 56 78")).toEqual({ digits: code("123456"), focus: 5 });
  });

  it("частичный код заполняет поля с начала", () => {
    expect(pasteCode(emptyCode(), "12")).toEqual({ digits: code("12____"), focus: 2 });
  });

  it("без цифр ничего не меняет", () => {
    expect(pasteCode(code("1_____"), "код")).toBeNull();
  });
});

describe("готовность кода", () => {
  it("код готов, только когда заполнены все шесть полей", () => {
    expect(isComplete(code("12345_"))).toBe(false);
    expect(isComplete(code("123456"))).toBe(true);
  });
});
