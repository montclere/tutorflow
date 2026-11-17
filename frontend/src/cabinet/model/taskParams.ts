import type { ParamField } from "../mocks/types";

/** Поле «Предмет» нужно только репетитору с несколькими предметами; с одним предмет берётся из профиля. */
export function withSubjectParam(params: ParamField[], subjects: string[], label: string): ParamField[] {
  return subjects.length > 1 ? [{ label, options: subjects }, ...params] : params;
}
