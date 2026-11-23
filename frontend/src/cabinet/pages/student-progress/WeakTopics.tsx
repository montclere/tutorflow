import { ArrowRight, Info, Target } from "lucide-react";
import { navigate } from "../../../app/router";
import { studentRoutes } from "../../../config/routes";
import { weakProgressPreview } from "../../model/studentProgressView";
import type { StudentProgress } from "../../tasks/progress";
import { learnText } from "../learn/learn.ru";
import styles from "./student-progress.module.css";

const text = learnText.progress;

export function WeakTopics({ progress, trainable }: { progress: StudentProgress; trainable: ReadonlySet<number> }) {
  const weak = weakProgressPreview(progress.weak, trainable, progress.mode === "exam");
  const target = weak.units.find(unit => unit.number === weak.number);
  return <section className={styles.card} aria-labelledby="progress-weak-topics">
    <div className={styles.sectionTitle}><Target size={26} aria-hidden="true" /><div><h2 id="progress-weak-topics">{text.weakTitle}</h2><p>{text.weakHint}</p></div></div>
    {weak.units.length > 0 ? <div className={styles.weakBody}>
      <ul className={styles.weakList}>{weak.units.map(unit => <li key={unit.key}><span className={styles.numberBadge}>{unit.number ?? "—"}</span><div><b>{unit.label}</b><span>{unit.correct} {text.masteredNote(unit.total)}</span></div></li>)}</ul>
      <div className={styles.trainRow}><button type="button" className={styles.train} disabled={weak.number === null} aria-label={weak.number !== null && target ? text.trainLabel(weak.number, target.label) : text.train} onClick={() => weak.number !== null && navigate(`${studentRoutes.trainer}?mode=number&number=${weak.number}`)}>{text.train}<ArrowRight size={21} aria-hidden="true" /></button>{weak.number === null && <span>{text.noTraining}</span>}</div>
    </div> : <p className={styles.weakEmpty}>{progress.units.some(unit => unit.level !== null) ? learnText.home.weakEmpty : text.weakNoData}</p>}
    <details className={styles.explanation}><summary><Info size={16} aria-hidden="true" />{text.howTitle}</summary><p>{progress.mode === "exam" ? text.howExam : text.howTopics}</p></details>
  </section>;
}
