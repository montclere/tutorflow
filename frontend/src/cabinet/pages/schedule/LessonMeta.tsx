import { Repeat } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import type { PaymentStatus, ScheduleLesson, Student, Tone } from "../../mocks/types";
import { lessonEnd } from "../../model/lessons";
import { Pill } from "../../ui/Pill";

const text = cabinet.teacher.schedule;

const paymentTones: Record<PaymentStatus, Tone> = { paid: "ok", debt: "bad", low: "warn" };

export function lessonTime(lesson: ScheduleLesson): string {
  return `${lesson.start}–${lessonEnd(lesson)}`;
}

export function PaymentBadge({ payment, full }: { payment: PaymentStatus; full?: boolean }) {
  return <Pill tone={paymentTones[payment]}>{full ? text.payFull[payment] : text.pay[payment]}</Pill>;
}

export function RecurringIcon() {
  return <Repeat size={12} aria-label={text.recurring} />;
}

export function lessonSummary(lesson: ScheduleLesson, student: Student): string {
  return `${student.name} · ${lessonTime(lesson)} · ${student.subject}`;
}
