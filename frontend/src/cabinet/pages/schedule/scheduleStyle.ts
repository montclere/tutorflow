import type { CSSProperties } from "react";
import type { Student } from "../../mocks/types";

export function lessonColorStyle(student: Student): CSSProperties {
  return {
    "--lesson-soft": `var(--cab-tone-${student.color})`,
    "--lesson-strong": `var(--cab-tone-${student.color}-strong)`,
  } as CSSProperties;
}
