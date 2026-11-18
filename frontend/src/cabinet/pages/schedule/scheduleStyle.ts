import type { CSSProperties } from "react";
import type { StudentColor } from "../../mocks/types";

export function lessonColorStyle(person: { color: StudentColor }): CSSProperties {
  return {
    "--lesson-soft": `var(--cab-tone-${person.color})`,
    "--lesson-strong": `var(--cab-tone-${person.color}-strong)`,
  } as CSSProperties;
}
