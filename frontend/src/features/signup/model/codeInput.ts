// Код подтверждения — 8 цифр (docs/api/identity.md).
export const CODE_LENGTH = 8;

export type CodeDigits = readonly string[];
export type CodeChange = { digits: CodeDigits; focus: number };

export const emptyCode = (): CodeDigits => Array.from({ length: CODE_LENGTH }, () => "");

export const isComplete = (digits: CodeDigits) => digits.every((digit) => digit !== "");

const onlyDigits = (text: string) => text.replace(/\D/g, "");

export function pasteCode(digits: CodeDigits, text: string): CodeChange | null {
  const pasted = onlyDigits(text).slice(0, CODE_LENGTH);
  if (!pasted) return null;
  const next = digits.map((digit, index) => pasted[index] ?? digit);
  return { digits: next, focus: Math.min(pasted.length, CODE_LENGTH - 1) };
}

export function enterDigits(digits: CodeDigits, index: number, value: string): CodeChange | null {
  if (value === "") {
    return { digits: digits.map((digit, i) => (i === index ? "" : digit)), focus: index };
  }
  const typed = onlyDigits(value);
  if (!typed) return null;
  // Автозаполнение кода из SMS и почты кладёт все цифры в одно поле.
  if (typed.length >= CODE_LENGTH) return pasteCode(digits, typed);
  const digit = typed.slice(-1);
  return {
    digits: digits.map((current, i) => (i === index ? digit : current)),
    focus: Math.min(index + 1, CODE_LENGTH - 1),
  };
}

export function backspaceTarget(digits: CodeDigits, index: number): number | null {
  return digits[index] === "" && index > 0 ? index - 1 : null;
}
