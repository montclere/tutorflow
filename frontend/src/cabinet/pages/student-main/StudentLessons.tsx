import { BookOpen, Calculator, CalendarDays, ArrowRight } from "lucide-react";
import { useRef, useState } from "react";
import { addDays, formatDayMonth } from "../../model/dates";
import type { StudentHomeLesson } from "../../model/studentHome";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { learnText } from "../learn/learn.ru";
import styles from "./student-main.module.css";

const text = learnText.studentMain;

function Lesson({ lesson, today }: { lesson: StudentHomeLesson; today: string }) {
  const day = lesson.date === today ? text.today : lesson.date === addDays(today, 1) ? text.tomorrow : formatDayMonth(lesson.date);
  const Icon = lesson.kind === "math" ? Calculator : BookOpen;
  return <li className={styles.lesson}>
    <time className={styles.lessonTime} dateTime={`${lesson.date}T${lesson.start}`}><span>{day}</span><b>{lesson.start}</b></time>
    <span className={styles.subjectIcon}><Icon aria-hidden="true" /></span>
    <span className={styles.lessonPerson}><b>{lesson.subject}</b><span>{lesson.teacher}</span></span>
  </li>;
}

export function StudentLessons({ lessons, today }: { lessons: StudentHomeLesson[]; today: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <section className={`${styles.card} ${styles.lessons}`} aria-labelledby="student-lessons-heading">
    <header className={styles.sectionHeader}><span className={styles.sectionIcon}><CalendarDays aria-hidden="true" /></span><h2 id="student-lessons-heading">{text.lessons}</h2><button ref={trigger} type="button" className={styles.textLink} onClick={() => setOpen(true)}>{text.allLessons}<ArrowRight aria-hidden="true" /></button></header>
    {lessons.length === 0 ? <p className={styles.empty}>{text.noLessons}</p> : <ul className={styles.lessonList}>{lessons.slice(0, 2).map((lesson) => <Lesson key={lesson.id} lesson={lesson} today={today} />)}</ul>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={styles.lessonsDialog} onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }}>
        <DialogHeader><DialogTitle>{text.allLessons}</DialogTitle><DialogDescription>{text.lessonsDescription}</DialogDescription></DialogHeader>
        {lessons.length === 0 ? <p className={styles.empty}>{text.noLessons}</p> : <ul className={styles.dialogList}>{lessons.map((lesson) => <Lesson key={lesson.id} lesson={lesson} today={today} />)}</ul>}
      </DialogContent>
    </Dialog>
  </section>;
}
