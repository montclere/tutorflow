import type { PaymentModel, PaymentMove, StudentColor, StudentRecord } from "../mocks/types";

const COLORS: StudentColor[] = ["peach", "mint", "rose", "sky", "lilac", "teal"];
const KOPECKS_IN_RUBLE = 100;

export type NewStudentInput = {
  name: string;
  goal: string;
  tariff: PaymentModel;
  priceRub: number;
  packageLessons: number;
  parent: string;
};

export type NewStudentError = "name" | "price" | "lessons";

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function pickColor(index: number): StudentColor {
  return COLORS[index % COLORS.length] ?? "peach";
}

export function rublesToKopecks(rubles: number): number {
  return Math.round(rubles * KOPECKS_IN_RUBLE);
}

export function newStudentErrors(input: NewStudentInput): NewStudentError[] {
  const errors: NewStudentError[] = [];
  if (input.name.trim() === "") errors.push("name");
  if (!(input.priceRub > 0)) errors.push("price");
  if (input.tariff === "package" && !(input.packageLessons >= 1)) errors.push("lessons");
  return errors;
}

/** Новый ученик сразу активен, без истории; ждёт, пока подключится по ссылке (STUDENTS-2). */
export function buildStudentRecord(input: NewStudentInput, meta: { id: string; today: string; colorIndex: number }): StudentRecord {
  const name = input.name.trim().replace(/\s+/g, " ");
  const price = rublesToKopecks(input.priceRub);
  const parent = input.parent.trim();
  return {
    id: meta.id,
    name,
    initials: initialsOf(name),
    color: pickColor(meta.colorIndex),
    goal: input.goal.trim(),
    status: "active",
    payment:
      input.tariff === "package"
        ? { model: "package", pricePerLesson: price, package: { lessons: input.packageLessons, price, left: input.packageLessons } }
        : { model: "per_lesson", pricePerLesson: price },
    balance: 0,
    lessonsCount: 0,
    startedAt: meta.today,
    telegramConnected: false,
    ...(parent ? { parent: { name: "", relation: "", phone: parent } } : {}),
    source: "Другое",
    recentLessons: [],
    note: "",
  };
}

export type PaymentInput = { amountRub: number; date: string };
export type PaymentError = "amount" | "future";

export function paymentErrors(input: PaymentInput, today: string): PaymentError[] {
  const errors: PaymentError[] = [];
  if (!(input.amountRub > 0)) errors.push("amount");
  if (input.date > today) errors.push("future");
  return errors;
}

export function paymentMove(input: PaymentInput, method: string): PaymentMove {
  return { date: input.date, title: `Оплата · ${method}`, amount: rublesToKopecks(input.amountRub) };
}

export function inviteText(name: string, link: string): string {
  const firstName = name.trim().split(/\s+/)[0] ?? "";
  return `${firstName}, здравствуйте! Вот ссылка в мой кабинет: расписание, домашние задания и оплаты будут там. ${link}`;
}
