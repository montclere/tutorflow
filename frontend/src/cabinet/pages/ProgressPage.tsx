import { demoStudentId } from "../mocks/student";
import { goals, useStudentProgress } from "../tasks/learner";
import { practiceNumbers } from "../tasks/practice";
import { learnText } from "./learn/learn.ru";
import { ProgressSummary } from "./student-progress/ProgressSummary";
import { TopicMap } from "./student-progress/TopicMap";
import { WeeklyResults } from "./student-progress/WeeklyResults";
import { WeakTopics } from "./student-progress/WeakTopics";
import styles from "./student-progress/student-progress.module.css";

const text = learnText.progress;

/** STUDENT-PROGRESS-UI-1/2: новый UI, прежние прогресс, цели и банк тренировок. */
export function ProgressPage() {
  const progress = useStudentProgress(demoStudentId);
  const goal = goals[demoStudentId];
  const trainable = goal?.kind === "exam" ? practiceNumbers(goal.exam) : new Set<number>();
  return <div className={styles.root}>
    <header className={styles.heading}><h1>{text.title}</h1></header>
    {progress ? <>
      <ProgressSummary progress={progress} />
      <TopicMap progress={progress} trainable={trainable} />
      <div className={styles.bottom}><WeeklyResults points={progress.trend} /><WeakTopics progress={progress} trainable={trainable} /></div>
    </> : <section className={styles.card}><div className={styles.empty}><h2>{text.noProgress}</h2><p>{text.noProgressNote}</p></div></section>}
  </div>;
}
