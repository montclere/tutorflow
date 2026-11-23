import { CalendarDays, Wallet } from "lucide-react";
import { cabinet } from "../../../content/cabinet.ru";
import type { ScheduleLesson, Student } from "../../../mocks/types";
import { formatRubles } from "../../../model/format";
import { balanceNote, formatBalance, nextLessonText } from "../StudentsTable";
import styles from "./student-tabs.module.css";

const students = cabinet.teacher.students;
const text = students.profile.summary;

export function NextLessonCard({ student, today, next, onOpenLesson }: { student: Student; today: string; next?: ScheduleLesson; onOpenLesson: (lesson: ScheduleLesson) => void }) {
  const schedule = student.schedule;
  const content = <>
    <span className={styles.summaryLabel}><CalendarDays aria-hidden="true" />{text.next}</span>
    <b className={styles.nextTime}>{next ? nextLessonText({ ...student, nextLesson: next }, today) : text.noNext}</b>
    {schedule.timesPerWeek > 0 && <span role="list" className={styles.weekdays} aria-label={text.daysLabel}>{cabinet.weekdays.map((day) => <span role="listitem" key={day} data-active={schedule.days.includes(day)} aria-label={schedule.days.includes(day) ? `${day}: ${text.daysLabel}` : day}>{day}</span>)}</span>}
    {next && <span className={styles.nextNote}>{schedule.time === students.mixedTime ? `${text.mixedTime} · ` : ""}{text.duration(next.durationMin)}</span>}
  </>;
  return next ? <button type="button" className={styles.nextCard} aria-label={`${students.profile.overview.openLesson}: ${nextLessonText({ ...student, nextLesson: next }, today)}`} onClick={() => onOpenLesson(next)}>{content}</button> : <section className={styles.nextCard} aria-label={text.next}>{content}</section>;
}

export function PaymentSummary({ student }: { student: Student }) {
  const { payment } = student;
  const pack = payment.model === "package" ? payment.package : undefined;
  const note = balanceNote(student);
  return <section className={`${styles.panel} ${styles.paymentSummary}`}>
    <h3><Wallet aria-hidden="true" />{text.payment}</h3>
    <b className={`${styles.balance} ${student.balance < 0 ? styles.bad : student.balance > 0 ? styles.good : ""}`}>{formatBalance(student.balance)}</b>
    {note && <p className={styles.paymentNote} data-warning={note.warn}>{note.text}</p>}
    <dl><div><dt>{text.tariff}</dt><dd>{pack ? students.payment.package : students.payment.perLesson}</dd><span>{pack ? text.lessonsLeft(pack.left, pack.lessons) : students.payment.pricePerLesson(formatRubles(payment.pricePerLesson))}</span></div><div><dt>{text.doneShort}</dt><dd>{student.lessonsCount}</dd><span>{text.lessonsUnit}</span></div></dl>
  </section>;
}
