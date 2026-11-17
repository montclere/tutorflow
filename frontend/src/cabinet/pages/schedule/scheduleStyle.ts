import type { CSSProperties } from "react";
import type { PaymentStatus, Student } from "../../mocks/types";

export type ColorMode = "student" | "payment";

const paymentColors: Record<PaymentStatus, { soft: string; strong: string }> = {
  paid: { soft: "var(--cab-ok-soft)", strong: "var(--color-positive)" },
  debt: { soft: "var(--cab-bad-soft)", strong: "var(--color-error)" },
  low: { soft: "var(--cab-warn-soft)", strong: "var(--cab-warn)" },
};

export function lessonColorStyle(student: Student, mode: ColorMode): CSSProperties {
  const colors =
    mode === "payment"
      ? paymentColors[student.payment]
      : { soft: `var(--cab-tone-${student.color})`, strong: `var(--cab-tone-${student.color}-strong)` };
  return { "--lesson-soft": colors.soft, "--lesson-strong": colors.strong } as CSSProperties;
}
