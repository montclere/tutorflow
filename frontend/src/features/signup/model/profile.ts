import type { StudentsRange } from "../../auth/api/types";

export const subjectIds = ["math", "english", "russian", "physics", "chemistry", "other"] as const;
export type SubjectId = (typeof subjectIds)[number];

export const studentsRanges: readonly StudentsRange[] = ["upTo5", "from6To15", "from16To30", "over30"];
