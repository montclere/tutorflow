import { ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, FileText } from "lucide-react";
import { navigate } from "../../app/router";
import { studentRoutes } from "../../config/routes";
import { getSchedule, getStudent } from "../data";
import { useStudents } from "../data/useStudents";
import { demoStudentId } from "../mocks/student";
import { studentHomeLessons } from "../mocks/studentHome";
import { formatDayMonth } from "../model/dates";
import { growthShare, mainStudentAssignment, upcomingStudentHomeLessons } from "../model/studentHome";
import { goals, useStudentProgress } from "../tasks/learner";
import { useLibrary } from "../tasks/library";
import { practiceNumbers } from "../tasks/practice";
import { CabinetLink } from "../ui/CabinetLink";
import { learnText } from "./learn/learn.ru";
import { StudentLessons } from "./student-main/StudentLessons";
import styles from "./student-main/student-main.module.css";

const text = learnText.studentMain;

/** Демо-главная: прежние прогресс и выдачи в новой композиции (STUDENT-MAIN-UI-1/2). */
export function StudentHomePage() {
  useStudents();
  const student = getStudent(demoStudentId);
  const progress = useStudentProgress(demoStudentId);
  const { works, assignments } = useLibrary();
  const { today, now } = getSchedule();
  const goal = goals[demoStudentId];
  const firstName = student.name.split(" ")[0] ?? student.name;
  const current = mainStudentAssignment(demoStudentId, assignments, works);
  const lessons = upcomingStudentHomeLessons(demoStudentId, studentHomeLessons, today, now);
  const trainable = practiceNumbers(goal?.kind === "exam" ? goal.exam : "ege-russian");

  return <div className={styles.root}>
    <section className={styles.hero} aria-labelledby="student-greeting">
      <h1 id="student-greeting">{learnText.home.greeting(firstName)}<svg viewBox="0 0 520 22" preserveAspectRatio="none" aria-hidden="true"><path d="M8 13C152 0 364 0 510 12" /></svg></h1>
      <svg className={styles.heroRays} viewBox="0 0 80 60" fill="none" aria-hidden="true"><path d="m10 30 17 13m9-33 8 22m20-29 1 23" /></svg>
      <div className={styles.heroArt} aria-hidden="true"><span /><img src="/student-main/planner.webp" srcSet="/student-main/planner-600.webp 600w, /student-main/planner.webp 1200w" sizes="(max-width: 720px) 280px, 410px" width="1200" height="675" alt="" fetchPriority="high" decoding="async" draggable="false" /></div>
    </section>

    <div className={styles.topCards}>
      <section className={`${styles.card} ${styles.preparation}`} aria-labelledby="preparation-heading">
        <h2 id="preparation-heading">{text.preparation}</h2>
        {progress ? <div className={styles.planProgress}><div className={styles.planBar} role="progressbar" aria-label={text.preparation} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.readiness}><span style={{ width: `${progress.readiness}%` }} /></div><b>{progress.readiness}%</b></div> : <p className={styles.empty}>{text.noProgress}</p>}
        <p className={styles.goal}><CalendarDays aria-hidden="true" />{goal?.kind === "exam" && progress ? text.examLine(progress.title, goal.daysLeft ?? 0) : goal?.kind === "topics" ? goal.title : student.goal}</p>
        <CabinetLink href={studentRoutes.trainer} className={styles.primary}>{text.continue}<ArrowRight aria-hidden="true" /></CabinetLink>
      </section>
      <section className={`${styles.card} ${styles.assignments}`} aria-labelledby="assignments-heading">
        <h2 id="assignments-heading">{text.assignments}</h2>
        {current ? <div className={styles.assignment}><span className={styles.assignmentIcon}><FileText aria-hidden="true" /></span><div className={styles.assignmentInfo}><b>{current.work.title}</b><span>{text.due(formatDayMonth(current.assignment.due))}</span>{current.assignment.status === "wait" && <small>{text.onReview}</small>}</div><CabinetLink href={studentRoutes.tasks} className={styles.secondary}>{text.open}<ArrowRight aria-hidden="true" /></CabinetLink></div> : <div className={styles.empty}><p>{text.emptyAssignments}</p><CabinetLink className={styles.textLink} href={studentRoutes.tasks}>{text.allAssignments}<ArrowRight aria-hidden="true" /></CabinetLink></div>}
      </section>
    </div>

    <StudentLessons lessons={lessons} today={today} />

    <section className={`${styles.card} ${styles.growth}`} aria-labelledby="growth-heading">
      <header className={styles.sectionHeader}><span className={styles.sectionIcon}><ChartNoAxesColumnIncreasing aria-hidden="true" /></span><div><h2 id="growth-heading">{text.growth}</h2><p>{text.growthHint}</p></div></header>
      {!progress || progress.weak.length === 0 ? <p className={styles.empty}>{learnText.home.weakEmpty}</p> : <ul className={styles.growthList}>{progress.weak.map((unit) => {
        const share = growthShare(unit);
        const content = <><b>{unit.label}</b><span className={styles.growthBar} aria-hidden="true"><span style={{ width: `${share}%` }} /></span><span className={styles.growthPercent}>{share}%</span></>;
        return <li key={unit.key}>{unit.number !== undefined && trainable.has(unit.number) ? <button type="button" className={styles.growthRow} aria-label={`${text.train(unit.label)}, ${share}%`} onClick={() => navigate(`${studentRoutes.trainer}?mode=number&number=${unit.number}`)}>{content}</button> : <div className={styles.growthRow}>{content}</div>}</li>;
      })}</ul>}
    </section>
  </div>;
}
