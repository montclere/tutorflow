import { createContext, useContext } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { PaymentStatus, ScheduleLesson, StudentColor } from "../../mocks/types";
import { formatRubles, formatSigned } from "../../model/format";
import { paymentStatus } from "../../model/students";

/** Кто на уроке — то, что нужно представлениям расписания. Демо берёт это из тестовых учеников, рабочая сборка — из карточек и уроков API. */
export type LessonPerson = { name: string; initials: string; color: StudentColor; goal: string; payment: PaymentStatus | null };
export type LessonFact = { label: string; value: string };

export type SchedulePeople = {
  personOf: (lesson: ScheduleLesson) => LessonPerson;
  /** Подробности ближайшего урока в виде «День». */
  factsOf: (lesson: ScheduleLesson) => LessonFact[];
};

const next = cabinet.teacher.schedule.next;

export const demoPeople: SchedulePeople = {
  personOf: (lesson) => {
    const student = getStudent(lesson.studentId);
    return { name: student.name, initials: student.initials, color: student.color, goal: student.goal, payment: paymentStatus(student) };
  },
  factsOf: (lesson) => {
    const student = getStudent(lesson.studentId);
    return [
      { label: next.topic, value: student.recentLessons[0]?.topic ?? next.none },
      { label: next.homework, value: student.recentLessons[0]?.homework?.title ?? next.none },
      { label: next.balance, value: student.balance === 0 ? formatRubles(0) : formatSigned(student.balance) },
      { label: next.note, value: student.note },
    ];
  },
};

export const SchedulePeopleContext = createContext<SchedulePeople>(demoPeople);

export function useSchedulePeople(): SchedulePeople {
  return useContext(SchedulePeopleContext);
}
