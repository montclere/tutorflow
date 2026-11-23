import type { LessonTemplate, ScheduleLesson, WorkHours } from "./types";

export const scheduleToday = "2026-11-17";
export const scheduleNow = "14:35";
export const scheduleRange = { from: "2026-10-01", to: "2026-12-31" };

export const workHours: WorkHours = { start: "12:00", end: "20:00", minFreeWindowMin: 90 };

const hour = 60;

export const lessonTemplates: LessonTemplate[] = [
  { id: "mon-orlova", studentId: "orlova", weekday: 0, start: "14:00", durationMin: hour, type: "individual" },
  { id: "mon-volkova", studentId: "volkova", weekday: 0, start: "16:00", durationMin: hour, type: "individual" },
  { id: "mon-ivanov", studentId: "ivanov", weekday: 0, start: "18:00", durationMin: hour, type: "individual" },
  { id: "tue-orlova", studentId: "orlova", weekday: 1, start: "12:00", durationMin: hour, type: "individual" },
  { id: "tue-ivanov", studentId: "ivanov", weekday: 1, start: "15:00", durationMin: hour, type: "individual" },
  { id: "tue-smirnova", studentId: "smirnova", weekday: 1, start: "16:30", durationMin: hour, type: "individual" },
  { id: "tue-petrov", studentId: "petrov", weekday: 1, start: "18:00", durationMin: hour, type: "individual" },
  { id: "tue-volkova", studentId: "volkova", weekday: 1, start: "19:00", durationMin: hour, type: "individual" },
  { id: "wed-smirnova", studentId: "smirnova", weekday: 2, start: "13:00", durationMin: hour, type: "individual" },
  { id: "wed-petrov", studentId: "petrov", weekday: 2, start: "17:00", durationMin: hour, type: "individual" },
  { id: "thu-orlova", studentId: "orlova", weekday: 3, start: "16:00", durationMin: hour, type: "individual" },
  { id: "thu-smirnova", studentId: "smirnova", weekday: 3, start: "17:00", durationMin: hour, type: "group", groupTitle: "Группа ОГЭ" },
  { id: "thu-volkova", studentId: "volkova", weekday: 3, start: "18:30", durationMin: hour, type: "individual" },
  { id: "fri-ivanov", studentId: "ivanov", weekday: 4, start: "14:00", durationMin: hour, type: "individual" },
  { id: "fri-petrov", studentId: "petrov", weekday: 4, start: "16:00", durationMin: hour, type: "individual" },
  { id: "fri-volkova", studentId: "volkova", weekday: 4, start: "17:30", durationMin: hour, type: "individual" },
  { id: "fri-orlova", studentId: "orlova", weekday: 4, start: "19:00", durationMin: hour, type: "individual" },
];

export const singleLessons: ScheduleLesson[] = [
  { id: "trial-sokolov", studentId: "sokolov", date: "2026-11-21", start: "12:00", durationMin: hour, type: "trial", recurring: false },
];
