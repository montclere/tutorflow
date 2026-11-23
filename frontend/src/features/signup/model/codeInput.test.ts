import { describe, expect, it } from "vitest";
import { backspaceTarget, emptyCode, enterDigits, isComplete, pasteCode } from "./codeInput";

const code = (value: string) => value.split("").map((char) => (char === "_" ? "" : char));

describe("ввод цифры", () => {
  it("записывает цифру и переносит фокус в следующее поле", () => {
    expect(enterDigits(emptyCode(), 0, "4")).toEqual({ digits: code("4_______"), focus: 1 });
  });

  it("в последнем поле оставляет фокус на месте", () => {
    expect(enterDigits(code("1234567_"), 7, "8")).toEqual({ digits: code("12345678"), focus: 7 });
  });

  it("заменяет цифру в заполненном поле последней введённой", () => {
    expect(enterDigits(code("1_______"), 0, "17")).toEqual({ digits: code("7_______"), focus: 1 });
  });

  it("игнорирует буквы и символы", () => {
    expect(enterDigits(code("1_______"), 1, "a")).toBeNull();
    expect(enterDigits(code("1_______"), 1, " -")).toBeNull();
  });

  it("очищает поле при удалении цифры", () => {
    expect(enterDigits(code("12______"), 1, "")).toEqual({ digits: code("1_______"), focus: 1 });
  });

  it("раскладывает по полям код, автозаполненный в одно поле", () => {
    expect(enterDigits(emptyCode(), 0, "87654321")).toEqual({ digits: code("87654321"), focus: 7 });
  });
});

describe("Backspace", () => {
  it("в пустом поле переводит фокус в предыдущее", () => {
    expect(backspaceTarget(code("12______"), 2)).toBe(1);
  });

  it("в заполненном поле не двигает фокус", () => {
    expect(backspaceTarget(code("123_____"), 2)).toBeNull();
  });

  it("в первом поле не двигает фокус", () => {
    expect(backspaceTarget(emptyCode(), 0)).toBeNull();
  });
});

describe("вставка из буфера", () => {
  it("заполняет все поля и ставит фокус в последнее", () => {
    expect(pasteCode(emptyCode(), "12345678")).toEqual({ digits: code("12345678"), focus: 7 });
  });

  it("берёт только цифры и не больше восьми", () => {
    expect(pasteCode(emptyCode(), "12-34 56 78 90")).toEqual({ digits: code("12345678"), focus: 7 });
  });

  it("частичный код заполняет поля с начала", () => {
    expect(pasteCode(emptyCode(), "12")).toEqual({ digits: code("12______"), focus: 2 });
  });

  it("без цифр ничего не меняет", () => {
    expect(pasteCode(code("1_______"), "код")).toBeNull();
  });
});

describe("готовность кода", () => {
  it("код готов, только когда заполнены все восемь полей", () => {
    expect(isComplete(code("1234567_"))).toBe(false);
    expect(isComplete(code("12345678"))).toBe(true);
  });
});
