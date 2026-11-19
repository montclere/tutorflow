import { Info, Target, TrendingUp, Trophy } from "lucide-react";
import { navigate } from "../../app/router";
import { studentRoutes } from "../../config/routes";
import { demoStudentId } from "../mocks/student";
import { goals, useStudentProgress } from "../tasks/learner";
import { practiceNumbers } from "../tasks/practice";
import { cx } from "../ui/cx";
import { PageHead } from "../ui/PageHead";
import { chunky } from "./learn/chunky";
import styles from "./learn/learn.module.css";
import { learnText } from "./learn/learn.ru";
import { Ring } from "./learn/Ring";
import { ResultBars } from "./students/profile/ResultBars";

const text = learnText.progress;
const levelTones = [
  "border-[color-mix(in_srgb,var(--color-error)_30%,transparent)] bg-[var(--cab-bad-soft)]",
  "border-[color-mix(in_srgb,var(--cab-warn)_30%,transparent)] bg-[var(--cab-warn-soft)]",
  "border-[var(--cab-lime-border)] bg-[var(--cab-lime-soft)]",
  "border-[color-mix(in_srgb,var(--color-success,#16a34a)_30%,transparent)] bg-[var(--cab-ok-soft)]",
];
const barTones = ["bg-destructive", "bg-[var(--cab-warn)]", "bg-[var(--color-lime)]", "bg-success"];

function Fact({ icon: Icon, label, value, note }: { icon: typeof Target; label: string; value: string; note: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
      <span className="grid size-10 place-items-center rounded-xl bg-card text-primary" aria-hidden="true">
        <Icon size={20} />
      </span>
      <div className="grid">
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
        <b className="font-[family-name:var(--font-display)] text-lg font-black tabular-nums">{value}</b>
        <span className="text-xs font-semibold text-muted-foreground">{note}</span>
      </div>
    </div>
  );
}

/** Прогресс под цель ученика: экзамен — номера и прогноз баллов, программа — темы (STUDENT-1, STUDENT-6). */
export function ProgressPage() {
  const progress = useStudentProgress(demoStudentId);
  if (!progress) return null;
  const exam = progress.mode === "exam";
  const goal = goals[demoStudentId];
  const trainable = practiceNumbers(goal?.kind === "exam" ? goal.exam : "ege-math-profile");

  return (
    <>
      <PageHead title={text.title} />
      <div className="grid gap-4">
        <section className={cx("grid items-center gap-6 rounded-3xl border-2 bg-card p-6 min-[821px]:grid-cols-[auto_minmax(0,1fr)]", styles.rise)}>
          <Ring value={progress.readiness} size={168} stroke={16} label={text.readinessLabel(progress.readiness)}>
            <span className="grid leading-tight">
              <b className="font-[family-name:var(--font-display)] text-4xl font-black tabular-nums">{progress.readiness}%</b>
              <span className="text-xs font-bold text-muted-foreground">{learnText.home.readiness}</span>
            </span>
          </Ring>
          <div className="grid gap-4">
            <div className="grid gap-1">
              <h2 className="m-0 font-[family-name:var(--font-display)] text-2xl font-black">{exam ? text.examTitle(progress.title) : text.topicsTitle(progress.title)}</h2>
              {progress.forecast && (
                <p className="m-0 text-base font-bold">
                  {learnText.home.forecast(progress.forecast.score, progress.forecast.max)} <span className="font-semibold text-muted-foreground">· {text.forecastNote}</span>
                </p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Fact icon={Trophy} label={text.mastered} value={String(progress.mastered)} note={text.masteredNote(progress.units.length)} />
              <Fact icon={Target} label={text.accuracy} value={progress.accuracy === null ? "—" : `${progress.accuracy}%`} note={text.accuracyNote} />
              <Fact icon={TrendingUp} label={text.trendTitle} value={progress.trend.length > 0 ? `${progress.trend.at(-1)?.percent ?? 0}%` : "—"} note={progress.trend.at(-1)?.title ?? text.trendEmpty} />
            </div>
          </div>
        </section>

        <section className={cx("grid gap-4 rounded-3xl border-2 bg-card p-5", styles.rise)} style={{ "--delay": "80ms" } as React.CSSProperties}>
          <header className="grid gap-0.5">
            <h2 className="m-0 font-[family-name:var(--font-display)] text-base font-extrabold">{text.mapTitle[progress.mode]}</h2>
            <p className="m-0 text-sm font-semibold text-muted-foreground">{text.mapHint}</p>
          </header>
          <ul className={cx("m-0 grid list-none gap-2 p-0", exam ? "grid-cols-[repeat(auto-fill,minmax(92px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]")}>
            {progress.units.map((unit) => {
              const share = unit.total > 0 ? Math.round((unit.correct / unit.total) * 100) : 0;
              const levelName = unit.level === null ? learnText.noData : (learnText.levels[unit.level] ?? "");
              return (
                <li key={unit.key}>
                  <button
                    type="button"
                    disabled={!exam || unit.number === undefined || !trainable.has(unit.number)}
                    aria-label={text.cell(exam ? `№${unit.number}` : unit.label, levelName, unit.correct, unit.total)}
                    onClick={() => navigate(`${studentRoutes.trainer}?mode=number&number=${unit.number}`)}
                    className={cx(
                      "grid w-full appearance-none gap-1.5 rounded-2xl border-2 p-2.5 text-left text-foreground [font-family:inherit] transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-default",
                      unit.level === null ? "border-dashed border-border bg-card" : levelTones[unit.level],
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-1">
                      <b className={cx("font-[family-name:var(--font-display)] font-black", exam ? "text-xl" : "truncate text-sm")}>{exam ? unit.number : unit.label}</b>
                      <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{unit.total > 0 ? `${share}%` : ""}</span>
                    </span>
                    {exam && <span className="truncate text-[11px] font-semibold text-muted-foreground">{unit.label}</span>}
                    <span className="h-1.5 overflow-hidden rounded-full bg-card/80" aria-hidden="true">
                      <span className={cx("block h-full rounded-full", unit.level === null ? "bg-transparent" : barTones[unit.level])} style={{ width: `${share}%` }} />
                    </span>
                    <span className="text-[11px] font-extrabold text-muted-foreground">{levelName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1101px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className={cx("grid content-start gap-4 rounded-3xl border-2 bg-card p-5", styles.rise)} style={{ "--delay": "160ms" } as React.CSSProperties}>
            <header className="grid gap-0.5">
              <h2 className="m-0 font-[family-name:var(--font-display)] text-base font-extrabold">{text.trendTitle}</h2>
              <p className="m-0 text-sm font-semibold text-muted-foreground">{text.trendHint}</p>
            </header>
            {progress.trend.length === 0 ? <p className="m-0 text-sm font-semibold text-muted-foreground">{text.trendEmpty}</p> : <ResultBars points={progress.trend.slice(-8)} />}
          </section>
          <section className={cx("grid content-start gap-4 rounded-3xl border-2 bg-card p-5", styles.rise)} style={{ "--delay": "240ms" } as React.CSSProperties}>
            <header className="grid gap-0.5">
              <h2 className="m-0 font-[family-name:var(--font-display)] text-base font-extrabold">{text.weakTitle}</h2>
              <p className="m-0 text-sm font-semibold text-muted-foreground">{text.weakHint}</p>
            </header>
            {progress.weak.length === 0 ? (
              <p className="m-0 text-sm font-semibold text-muted-foreground">{learnText.home.weakEmpty}</p>
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0">
                {progress.weak.map((unit) => (
                  <li key={unit.key} className="flex items-center gap-3">
                    <span className="grid size-11 flex-none place-items-center rounded-2xl bg-[var(--cab-bad-soft)] font-[family-name:var(--font-display)] text-base font-black text-destructive">
                      {unit.number !== undefined ? unit.number : "•"}
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <b className="truncate text-sm font-extrabold">{unit.label}</b>
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                        {unit.correct} из {unit.total}
                      </span>
                    </span>
                    {unit.number !== undefined && trainable.has(unit.number) && (
                      <button type="button" className={chunky("ghost", "min-h-10 px-4 text-xs")} onClick={() => navigate(`${studentRoutes.trainer}?mode=number&number=${unit.number}`)}>
                        {learnText.home.train}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 rounded-2xl bg-secondary/60 p-3 text-xs font-semibold text-muted-foreground">
              <Info size={16} className="mt-0.5 flex-none" aria-hidden="true" />
              <span>
                <b className="text-foreground">{text.howTitle}. </b>
                {exam ? text.howExam : text.howTopics}
              </span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
