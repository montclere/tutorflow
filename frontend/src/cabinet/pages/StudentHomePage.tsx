import { CalendarClock, ChevronRight, ClipboardList, MessageSquareQuote, Zap } from "lucide-react";
import { navigate } from "../../app/router";
import { studentRoutes } from "../../config/routes";
import { getStudent, getStudentDetails } from "../data";
import { useStudents } from "../data/useStudents";
import { demoStudentId, studentFeedback } from "../mocks/student";
import { formatShortDate } from "../model/dates";
import { goals, useStudentProgress } from "../tasks/learner";
import { useLibrary } from "../tasks/library";
import { practiceNumbers, usePractice } from "../tasks/practice";
import { tasksText } from "../tasks/tasks.ru";
import { cx } from "../ui/cx";
import { MaterialIcon } from "../ui/MaterialIcon";
import { chunky } from "./learn/chunky";
import styles from "./learn/learn.module.css";
import { learnText } from "./learn/learn.ru";
import { Ring } from "./learn/Ring";

const text = learnText.home;

type PanelTone = "sky" | "lavender" | "pink" | "mint" | "peach";

/** Пастельные фоны блоков главной (VIBE-10): каждый блок узнаётся по цвету, карточки внутри — белые. */
const panelTones: Record<PanelTone, string> = {
  sky: "bg-[var(--vibe-sky)]",
  lavender: "bg-[var(--vibe-lavender)]",
  pink: "bg-[var(--vibe-pink)]",
  mint: "bg-[var(--vibe-mint)]",
  peach: "bg-[var(--vibe-peach)]",
};

type PanelProps = { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string; delay?: number; tone?: PanelTone };

function Panel({ title, action, children, className, delay = 0, tone }: PanelProps) {
  return (
    <section className={cx("grid content-start gap-4 rounded-3xl p-5", tone ? panelTones[tone] : "border-2 bg-card", styles.rise, className)} style={{ "--delay": `${delay}ms` } as React.CSSProperties}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="m-0 font-[family-name:var(--font-display)] text-base font-extrabold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

const linkClass = "appearance-none border-0 bg-transparent p-0 text-sm font-extrabold text-primary [font-family:inherit] hover:underline";

/** Главная ученика: мини-мониторинг (за неделю, точность), урок, что в работе, прогресс под цель, слабые места, материалы (STUDENT-2). */
export function StudentHomePage() {
  useStudents();
  const student = getStudent(demoStudentId);
  const practice = usePractice();
  const progress = useStudentProgress(demoStudentId);
  const { works, assignments } = useLibrary();
  const goal = goals[demoStudentId];
  const firstName = student.name.split(" ")[0] ?? student.name;
  const now = assignments.filter((assignment) => assignment.studentId === demoStudentId && assignment.status !== "done").slice(0, 3);
  const materials = getStudentDetails(demoStudentId).materials.slice(0, 2);
  const trainable = practiceNumbers(goal?.kind === "exam" ? goal.exam : "ege-russian");
  const feedback = assignments.find((assignment) => assignment.studentId === demoStudentId && assignment.feedback && Object.keys(assignment.feedback).length > 0);

  return (
    <div className="grid gap-4">
      <section className={cx("relative grid items-center gap-6 overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground sm:grid-cols-[minmax(0,1fr)_auto]", styles.rise)}>
        <div className="grid gap-3">
          <h1 className="m-0 font-[family-name:var(--font-display)] text-3xl leading-tight font-black max-[520px]:text-2xl">{text.greeting(firstName)}</h1>
          <p className="m-0 text-base font-semibold text-primary-foreground/85">
            {goal?.kind === "exam" && progress ? text.examLine(progress.title, goal.daysLeft ?? 0) : goal?.kind === "topics" ? text.topicsLine(goal.title) : student.goal}
          </p>
        </div>
        {/* Мини-мониторинг вместо целей и опыта: сколько решено за неделю и точность. */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid min-w-28 gap-0.5 rounded-2xl bg-white/12 px-4 py-3">
            <b className="font-[family-name:var(--font-display)] text-2xl leading-none font-black tabular-nums">{practice.weekSolved}</b>
            <span className="text-xs font-bold text-primary-foreground/80">{text.weekLabel}</span>
          </span>
          <span className="grid min-w-28 gap-0.5 rounded-2xl bg-white/12 px-4 py-3">
            <b className="font-[family-name:var(--font-display)] text-2xl leading-none font-black tabular-nums">{progress?.accuracy === null || progress?.accuracy === undefined ? "—" : `${progress.accuracy}%`}</b>
            <span className="text-xs font-bold text-primary-foreground/80">{text.accuracy}</span>
          </span>
          <button type="button" className={chunky("lime")} onClick={() => navigate(studentRoutes.trainer)}>
            <Zap size={18} aria-hidden="true" />
            {text.practice}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1101px]:grid-cols-3">
        <Panel title={text.lessonTitle} delay={80} tone="sky">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-card text-primary" aria-hidden="true">
              <CalendarClock size={26} />
            </span>
            <div className="grid">
              <b className="font-[family-name:var(--font-display)] text-xl font-black">{text.lessonValue}</b>
              <span className="text-sm font-semibold text-muted-foreground">{text.lessonNote}</span>
            </div>
          </div>
        </Panel>

        <Panel
          title={text.nowTitle}
          delay={160}
          tone="peach"
          action={
            <button type="button" className={linkClass} onClick={() => navigate(studentRoutes.tasks)}>
              {text.allTasks}
            </button>
          }
        >
          {now.length === 0 ? (
            <p className="m-0 text-sm font-semibold text-muted-foreground">{text.nowEmpty}</p>
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0">
              {now.map((assignment) => {
                const work = works.find((item) => item.id === assignment.workId);
                if (!work) return null;
                return (
                  <li key={assignment.id}>
                    <button
                      type="button"
                      onClick={() => navigate(studentRoutes.tasks)}
                      className="flex w-full appearance-none items-center gap-3 rounded-2xl border-2 border-transparent bg-card p-2.5 text-left text-foreground [font-family:inherit] transition-colors hover:border-primary"
                    >
                      <span className={cx("grid size-10 flex-none place-items-center rounded-xl", work.kind === "test" ? "bg-highlight text-highlight-foreground" : "bg-accent text-primary")} aria-hidden="true">
                        {work.kind === "test" ? <Zap size={18} /> : <ClipboardList size={18} />}
                      </span>
                      <span className="grid min-w-0 flex-1">
                        <b className="truncate text-sm font-extrabold">{work.title}</b>
                        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                          {tasksText.student.status[assignment.status]} · {tasksText.student.due(formatShortDate(assignment.due))}
                        </span>
                      </span>
                      <ChevronRight size={18} className="text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title={text.progressTitle}
          delay={240}
          tone="lavender"
          action={
            <button type="button" className={linkClass} onClick={() => navigate(studentRoutes.progress)}>
              {text.allProgress}
            </button>
          }
        >
          {progress && (
            <div className="flex items-center gap-4">
              <Ring value={progress.readiness} size={96} stroke={10} label={learnText.progress.readinessLabel(progress.readiness)}>
                <span className="grid leading-tight">
                  <b className="font-[family-name:var(--font-display)] text-xl font-black tabular-nums">{progress.readiness}%</b>
                  <span className="text-[11px] font-bold text-muted-foreground">{progress.mode === "exam" ? text.readiness : text.topicsAverage}</span>
                </span>
              </Ring>
              <div className="grid gap-1 text-sm font-semibold">
                <b className="text-base font-extrabold">{progress.title}</b>
                {progress.forecast && <span>{text.forecast(progress.forecast.score, progress.forecast.max)}</span>}
                <span className="text-muted-foreground">{text.mastered(progress.mastered, progress.units.length)}</span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1101px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title={text.weakTitle} delay={320}>
          {!progress || progress.weak.length === 0 ? (
            <p className="m-0 text-sm font-semibold text-muted-foreground">{text.weakEmpty}</p>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0">
              {progress.weak.map((unit) => {
                const share = unit.total > 0 ? Math.round((unit.correct / unit.total) * 100) : 0;
                return (
                  <li key={unit.key} className="flex items-center gap-3">
                    <span className="grid size-11 flex-none place-items-center rounded-2xl bg-[var(--cab-bad-soft)] font-[family-name:var(--font-display)] text-base font-black text-destructive">
                      {unit.number !== undefined ? `№${unit.number}` : "•"}
                    </span>
                    <div className="grid min-w-0 flex-1 gap-1.5">
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <b className="truncate font-extrabold">{unit.label}</b>
                        <span className="font-bold text-muted-foreground tabular-nums">{share}%</span>
                      </span>
                      <div className={styles.bar} style={{ height: 10 }} aria-hidden="true">
                        <div className={styles.barFillBad} style={{ width: `${share}%` }} />
                      </div>
                    </div>
                    {unit.number !== undefined && trainable.has(unit.number) && (
                      <button type="button" className={chunky("ghost", "min-h-10 px-4 text-xs")} onClick={() => navigate(`${studentRoutes.trainer}?mode=number&number=${unit.number}`)}>
                        {text.train}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="grid content-start gap-4">
          <Panel
            title={text.materialsTitle}
            delay={400}
            tone="mint"
            action={
              <button type="button" className={linkClass} onClick={() => navigate(studentRoutes.materials)}>
                {text.allMaterials}
              </button>
            }
          >
            <ul className="m-0 grid list-none gap-2 p-0">
              {materials.map((material) => (
                <li key={material.id} className="flex items-center gap-3">
                  <MaterialIcon kind={material.kind} small />
                  <span className="grid min-w-0 flex-1">
                    <b className="truncate text-sm font-extrabold">{material.title}</b>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">{formatShortDate(material.sentAt)}</span>
                  </span>
                  {!material.openedAt && <span className="rounded-full bg-highlight px-2 py-0.5 text-xs font-extrabold text-highlight-foreground">new</span>}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={text.feedbackTitle} delay={480}>
            <div className="flex gap-3">
              <MessageSquareQuote size={22} className="flex-none text-primary" aria-hidden="true" />
              <p className="m-0 text-sm font-semibold">{feedback?.feedback ? Object.values(feedback.feedback).join(" ") : studentFeedback}</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
