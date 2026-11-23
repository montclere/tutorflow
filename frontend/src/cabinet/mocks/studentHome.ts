import type { StudentHomeLesson } from "../model/studentHome";

/** Два демонстрационных занятия из макета владельца; не записи преподавательского расписания/API. */
export const studentHomeLessons: StudentHomeLesson[] = [
  { id: "student-home-russian", studentId: "ivanov", date: "2026-11-17", start: "15:00", subject: "Русский язык", teacher: "Анна Кузнецова", kind: "russian" },
  { id: "student-home-math", studentId: "ivanov", date: "2026-11-18", start: "17:30", subject: "Математика", teacher: "Дмитрий Орлов", kind: "math" },
];
