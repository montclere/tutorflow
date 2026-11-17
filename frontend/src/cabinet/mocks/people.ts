import type { Person, Student } from "./types";

export const students: Student[] = [
  {
    id: "ivanov", name: "Александр Иванов", initials: "АИ", color: "peach", subject: "Математика · ЕГЭ профиль", status: "active", payment: "paid",
    balanceKopecks: 0, lessons: 18, progress: 68,
    lastTopic: "Показательные уравнения", homework: "Квадратные уравнения, 10 карточек", note: "Слабое место — №13, чаще проверять ОДЗ",
  },
  {
    id: "smirnova", name: "Мария Смирнова", initials: "МС", color: "mint", subject: "Математика · ОГЭ", status: "active", payment: "low",
    balanceKopecks: 450000, lessons: 24, progress: 88,
    lastTopic: "Теория вероятностей", homework: "Вариант ОГЭ №2, задания 1–14", note: "Остался один оплаченный урок, предложить новый пакет",
  },
  {
    id: "petrov", name: "Дмитрий Петров", initials: "ДП", color: "rose", subject: "Алгебра · 10 класс", status: "active", payment: "debt",
    balanceKopecks: -120000, lessons: 9, progress: 52,
    lastTopic: "Тригонометрические тождества", homework: "Тождества, задачи 1–8", note: "Есть долг, напомнить родителям",
  },
  {
    id: "orlova", name: "Екатерина Орлова", initials: "ЕО", color: "sky", subject: "Математика · ОГЭ", status: "active", payment: "paid",
    balanceKopecks: 480000, lessons: 12, progress: 71,
    lastTopic: "Геометрия: площади фигур", homework: "Вариант ОГЭ №3, задание 21", note: "Хорошо идёт геометрия, подтянуть алгебру",
  },
  {
    id: "volkova", name: "Полина Волкова", initials: "ПВ", color: "lilac", subject: "Математика · ЕГЭ база", status: "active", payment: "paid",
    balanceKopecks: 160000, lessons: 15, progress: 84,
    lastTopic: "Проценты и текстовые задачи", homework: "Вариант ЕГЭ база №2", note: "Занимается реже обычного, написать в Telegram",
  },
  {
    id: "sokolov", name: "Илья Соколов", initials: "ИС", color: "teal", subject: "Математика · 9 класс", status: "trial", payment: "paid",
    balanceKopecks: 0, lessons: 0, progress: 0,
    lastTopic: "Знакомство, входная диагностика", homework: "Нет", note: "Пробный урок, обсудить цели и расписание",
  },
];

export const teacherPerson: Person = { name: "Анна Кузнецова", initials: "АК", color: "sky", roleLabel: "Репетитор · Про" };
export const studentPerson: Person = { name: "Александр Иванов", initials: "АИ", color: "peach", roleLabel: "Ученик · ЕГЭ профиль" };

export const teacherSubjects = ["Математика"];
