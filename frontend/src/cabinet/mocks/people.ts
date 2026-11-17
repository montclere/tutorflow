import type { Person, Student } from "./types";

export const students: Student[] = [
  { id: "ivanov", name: "Александр Иванов", initials: "АИ", tone: "peach", subject: "Математика · ЕГЭ профиль", balanceKopecks: 0, lessons: 18, progress: 68 },
  { id: "smirnova", name: "Мария Смирнова", initials: "МС", tone: "mint", subject: "Английский · B1", balanceKopecks: 450000, lessons: 24, progress: 88 },
  { id: "petrov", name: "Дмитрий Петров", initials: "ДП", tone: "rose", subject: "Физика · 10 класс", balanceKopecks: -120000, lessons: 9, progress: 52 },
  { id: "orlova", name: "Екатерина Орлова", initials: "ЕО", tone: "sky", subject: "Математика · ОГЭ", balanceKopecks: 480000, lessons: 12, progress: 71 },
  { id: "volkova", name: "Полина Волкова", initials: "ПВ", tone: "lilac", subject: "Русский язык · ОГЭ", balanceKopecks: 160000, lessons: 15, progress: 84 },
];

export const teacherPerson: Person = { name: "Анна Кузнецова", initials: "АК", tone: "sky", roleLabel: "Репетитор · Про" };
export const studentPerson: Person = { name: "Александр Иванов", initials: "АИ", tone: "peach", roleLabel: "Ученик · ЕГЭ профиль" };
