import { cabinet } from "../../content/cabinet.ru";
import type { PaymentStatus, ScheduleLesson, Tone } from "../../mocks/types";
import { lessonEnd } from "../../model/lessons";
import { Pill } from "../../ui/Pill";

const text = cabinet.teacher.schedule;

const paymentTones: Record<PaymentStatus, Tone> = { paid: "ok", debt: "bad", low: "warn" };

export function lessonTime(lesson: ScheduleLesson): string {
  return `${lesson.start}–${lessonEnd(lesson)}`;
}

/** Время в строке урока: крупно начало, мелко длительность — не ломается в две строки на телефоне. */
export function RowTime({ lesson, className }: { lesson: ScheduleLesson; className?: string }) {
  return (
    <span className={className} aria-label={lessonTime(lesson)}>
      <b>{lesson.start}</b>
      <small>{text.lesson.duration(lesson.durationMin)}</small>
    </span>
  );
}

export function PaymentBadge({ payment, full }: { payment: PaymentStatus; full?: boolean }) {
  return <Pill tone={paymentTones[payment]}>{full ? text.payFull[payment] : text.pay[payment]}</Pill>;
}

export function lessonSummary(lesson: ScheduleLesson, person: { name: string; goal: string }): string {
  const status = lesson.status && lesson.status !== "scheduled" ? ` · ${text.outcome[lesson.status]}` : "";
  return `${person.name} · ${lessonTime(lesson)}${person.goal ? ` · ${person.goal}` : ""}${status}`;
}

/** Подпись под именем: цель или тема, а у отменённого или отмеченного урока — ещё и итог. */
export function lessonLine(lesson: ScheduleLesson, goal: string): string {
  const outcome = lesson.status && lesson.status !== "scheduled" ? text.outcome[lesson.status] : null;
  return [goal, outcome].filter(Boolean).join(" · ");
}

/** Отменённый урок остаётся в календаре, но перечёркнут — его можно открыть и восстановить. */
export function isCancelled(lesson: ScheduleLesson): boolean {
  return lesson.status === "cancelled";
}
