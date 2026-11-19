import { Check, Flag, Flame, Sparkles, Target, X, Zap } from "lucide-react";
import { useState } from "react";
import { navigate, useSearch } from "../../app/router";
import { studentRoutes } from "../../config/routes";
import { demoStudentId } from "../mocks/student";
import { examOf } from "../tasks/catalog";
import { answerText, checkAnswer, emptyResponse, isAnswered } from "../tasks/check";
import { goals, useStudentProgress } from "../tasks/learner";
import { pickTask, practiceNumbers, recordPractice, SESSION_LENGTH, usePractice, XP_RIGHT, XP_TRY, type PracticeMode } from "../tasks/practice";
import type { AnswerResponse, TaskItem } from "../tasks/types";
import { cx } from "../ui/cx";
import { PageHead } from "../ui/PageHead";
import { RichText } from "../ui/RichText";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { chunky } from "./learn/chunky";
import styles from "./learn/learn.module.css";
import { learnText } from "./learn/learn.ru";
import { Ring } from "./learn/Ring";
import { AnswerInput } from "./tasks/player/AnswerInput";

const text = learnText.trainer;
const levelTones = ["bg-[var(--cab-bad-soft)] text-destructive", "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]", "bg-[var(--cab-lime-soft)] text-foreground", "bg-[var(--cab-ok-soft)] text-success"];
const modes: PracticeMode[] = ["weak", "number", "mistakes"];

type Session = { index: number; right: number; combo: number; xp: number; recent: string[]; task: TaskItem | null; answer: AnswerResponse | null; result: boolean | null; done: boolean };

function newSession(): Session {
  return { index: 0, right: 0, combo: 0, xp: 0, recent: [], task: null, answer: null, result: null, done: false };
}

/** Тренажёр: бесконечные задачи с мгновенной проверкой, сессии по 10, комбо, опыт и цель дня (STUDENT-5). */
export function TrainerPage() {
  const params = new URLSearchParams(useSearch());
  const practice = usePractice();
  const progress = useStudentProgress(demoStudentId);
  const goal = goals[demoStudentId];
  const exam = goal?.kind === "exam" ? goal.exam : "ege-russian";
  const available = practiceNumbers(exam);
  const [mode, setMode] = useState<PracticeMode>(() => (modes.find((item) => item === params.get("mode")) ?? "weak"));
  const [number, setNumber] = useState<number | undefined>(() => (params.get("number") ? Number(params.get("number")) : [...available][0]));
  const [session, setSession] = useState<Session>(newSession);
  const weak = progress?.weak.map((unit) => unit.number).filter((value): value is number => value !== undefined) ?? [];

  const pick = (current: Session, seed: number): TaskItem | null => pickTask(mode, { exam, number, weak: weak.length > 0 ? weak : [...available], seed, recent: current.recent });

  const start = () => {
    const fresh = newSession();
    const task = pick(fresh, Date.now());
    setSession({ ...fresh, task, answer: task ? emptyResponse(task.answer) : null });
  };

  const check = () => {
    if (!session.task || !session.answer || !isAnswered(session.answer)) return;
    const correct = checkAnswer(session.task.answer, session.answer) === true;
    recordPractice(session.task, correct);
    setSession({ ...session, result: correct, right: session.right + Number(correct), combo: correct ? session.combo + 1 : 0, xp: session.xp + (correct ? XP_RIGHT : XP_TRY) });
  };

  const next = () => {
    const index = session.index + 1;
    if (index >= SESSION_LENGTH) {
      setSession({ ...session, done: true });
      return;
    }
    const recent = session.task ? [...session.recent, session.task.id] : session.recent;
    const task = pick({ ...session, recent }, Date.now() + index);
    setSession({ ...session, index, recent, task, answer: task ? emptyResponse(task.answer) : null, result: null });
  };

  const changeMode = (next: PracticeMode) => {
    setMode(next);
    setSession(newSession());
  };

  const goalPercent = Math.min(100, Math.round((practice.solvedToday / practice.dailyGoal) * 100));
  const running = session.task !== null && !session.done;

  return (
    <>
      <PageHead title={text.title} subtitle={text.subtitle} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 min-[1101px]:grid-cols-[minmax(0,1fr)_300px]">
        <section className="grid min-h-[420px] overflow-hidden rounded-3xl border-2 bg-card">
          {session.done ? (
            <div className="grid place-items-center gap-4 p-8 text-center">
              <span className={cx("grid size-24 place-items-center rounded-full bg-highlight text-highlight-foreground", styles.pop, styles.burst)} aria-hidden="true">
                <Sparkles size={40} />
              </span>
              <h2 className="m-0 font-[family-name:var(--font-display)] text-2xl font-black">{text.finishTitle}</h2>
              <p className="m-0 text-lg font-bold tabular-nums">{text.finishScore(session.right, SESSION_LENGTH)}</p>
              <span className={cx("rounded-full bg-highlight px-4 py-1.5 text-base font-extrabold text-highlight-foreground tabular-nums", styles.pop)}>{text.xpGain(session.xp)}</span>
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" className={chunky("primary")} onClick={start}>
                  {text.again}
                </button>
                <button type="button" className={chunky("ghost")} onClick={() => navigate(studentRoutes.home)}>
                  {text.toHome}
                </button>
              </div>
            </div>
          ) : running && session.task && session.answer ? (
            <>
              <div className="flex items-center gap-3 px-5 pt-5 sm:px-6">
                <button type="button" aria-label={text.close} className="grid size-9 appearance-none place-items-center rounded-full border-0 bg-transparent text-muted-foreground hover:bg-secondary" onClick={() => setSession(newSession())}>
                  <X size={20} aria-hidden="true" />
                </button>
                <div className={cx(styles.bar, "flex-1")} role="progressbar" aria-valuemin={0} aria-valuemax={SESSION_LENGTH} aria-valuenow={session.index} aria-label={text.session(session.index + 1, SESSION_LENGTH)}>
                  <div className={styles.barFill} style={{ width: `${((session.index + (session.result !== null ? 1 : 0)) / SESSION_LENGTH) * 100}%` }} />
                </div>
                {session.combo >= 2 && (
                  <span key={session.combo} className={cx("inline-flex items-center gap-1 rounded-full bg-[#fff1e6] px-2.5 py-1 text-sm font-extrabold text-[#ea580c]", styles.pop)}>
                    <Flame size={15} aria-hidden="true" />
                    {text.combo(session.combo)}
                  </span>
                )}
              </div>
              <article key={`${session.task.id}-${session.result}`} className={cx("grid content-start gap-6 p-5 sm:p-8", session.result === false && styles.shake)}>
                <span className="w-fit rounded-lg bg-accent px-2.5 py-1 text-xs font-extrabold text-accent-foreground">
                  {examOf(session.task.exam)?.label} · №{session.task.number} · {session.task.topic}
                </span>
                <p className="m-0 text-xl leading-snug font-bold">
                  <RichText parts={session.task.statement} />
                </p>
                <AnswerInput key={session.task.id} spec={session.task.answer} value={session.answer} locked={session.result !== null} onChange={(answer) => setSession({ ...session, answer })} onSubmit={session.result === null ? check : next} />
              </article>
              {session.result === null ? (
                <footer className="flex items-center justify-between gap-3 border-t-2 px-5 py-4 sm:px-6">
                  <button type="button" className={chunky("ghost")} onClick={next}>
                    {text.skip}
                  </button>
                  <button type="button" className={chunky("good")} disabled={!isAnswered(session.answer)} onClick={check}>
                    {text.check}
                  </button>
                </footer>
              ) : (
                <footer className={cx("flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6", styles.slideUp, session.result ? "bg-[var(--cab-ok-soft)]" : "bg-[var(--cab-bad-soft)]")} role="status">
                  <span className={cx("grid size-12 place-items-center rounded-full bg-card", session.result ? "text-success" : "text-destructive", styles.pop)} aria-hidden="true">
                    {session.result ? <Check size={26} /> : <X size={26} />}
                  </span>
                  <div className="grid min-w-0 flex-1">
                    <b className={cx("font-[family-name:var(--font-display)] text-xl font-black", session.result ? "text-success" : "text-destructive")}>
                      {session.result ? text.right[session.index % text.right.length] : text.wrong}
                    </b>
                    <span className="text-sm font-bold">{session.result ? text.xpGain(XP_RIGHT) : text.correctAnswer(answerText(session.task.answer))}</span>
                  </div>
                  <button type="button" className={chunky(session.result ? "good" : "bad", "max-[520px]:w-full")} onClick={next}>
                    {text.next}
                  </button>
                </footer>
              )}
            </>
          ) : (
            <div className="grid content-center justify-items-center gap-5 p-8 text-center">
              <span className={cx("grid size-24 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_0_color-mix(in_srgb,var(--color-blue)_60%,#000)]", styles.float)} aria-hidden="true">
                <Zap size={42} />
              </span>
              <div className="grid gap-1">
                <h2 className="m-0 font-[family-name:var(--font-display)] text-2xl font-black">{text.modes[mode]}</h2>
                <p className="m-0 max-w-sm text-sm font-semibold text-muted-foreground">{text.modeHints[mode]}</p>
              </div>
              {mode === "mistakes" && practice.mistakes.length === 0 ? (
                <p className="m-0 rounded-2xl bg-[var(--cab-ok-soft)] px-4 py-2 text-sm font-bold text-success">{text.emptyMistakes}</p>
              ) : mode === "number" && (number === undefined || !available.has(number)) ? (
                <p className="m-0 text-sm font-bold text-muted-foreground">{text.noNumber}</p>
              ) : (
                <button type="button" className={chunky("primary", "min-w-48")} onClick={start}>
                  {text.start}
                </button>
              )}
            </div>
          )}
        </section>

        <aside className="grid gap-4">
          <section className="grid grid-cols-3 gap-2 rounded-3xl border-2 bg-card p-4 text-center">
            <div className="grid justify-items-center gap-1">
              <Ring value={goalPercent} size={56} stroke={7} tone="var(--color-lime)" label={text.goalLabel}>
                <Target size={18} className="text-muted-foreground" aria-hidden="true" />
              </Ring>
              <b className="text-sm font-extrabold tabular-nums">{text.goal(practice.solvedToday, practice.dailyGoal)}</b>
              <span className="text-[11px] font-bold text-muted-foreground">{text.goalLabel}</span>
            </div>
            <div className="grid justify-items-center content-start gap-1">
              <span className="grid size-14 place-items-center rounded-full bg-[#fff1e6] text-[#ea580c]" aria-hidden="true">
                <Flame size={24} />
              </span>
              <b className="text-sm font-extrabold tabular-nums">{practice.streak}</b>
              <span className="text-[11px] font-bold text-muted-foreground">{text.streakLabel}</span>
            </div>
            <div className="grid justify-items-center content-start gap-1">
              <span className="grid size-14 place-items-center rounded-full bg-highlight text-highlight-foreground" aria-hidden="true">
                <Sparkles size={22} />
              </span>
              <b className="text-sm font-extrabold tabular-nums">{practice.xp}</b>
              <span className="text-[11px] font-bold text-muted-foreground">{text.xpLabel}</span>
            </div>
          </section>

          <section className="grid gap-3 rounded-3xl border-2 bg-card p-4">
            <ToggleGroup type="single" spacing={1} value={mode} aria-label={text.modesLabel} className="grid w-full grid-cols-3 gap-1 rounded-2xl bg-secondary p-1" onValueChange={(value) => value && changeMode(value as PracticeMode)}>
              {modes.map((item) => (
                <ToggleGroupItem key={item} value={item} className="h-auto min-h-9 rounded-xl px-1 py-1.5 text-xs leading-tight font-extrabold whitespace-normal data-[state=on]:bg-card data-[state=on]:shadow-sm">
                  {text.modes[item]}
                  {item === "mistakes" && practice.mistakes.length > 0 ? ` · ${practice.mistakes.length}` : ""}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {mode === "number" && (
              <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={text.numbersLabel}>
                {(examOf(exam)?.numbers ?? []).map((item) => {
                  const unit = progress?.units.find((candidate) => candidate.number === item.number);
                  const has = available.has(item.number);
                  const on = item.number === number;
                  return (
                    <button
                      key={item.number}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={!has}
                      title={has ? item.topic : `${item.topic}: ${text.noTasks}`}
                      onClick={() => {
                        setNumber(item.number);
                        setSession(newSession());
                      }}
                      className={cx(
                        "grid h-11 appearance-none place-items-center rounded-xl border-2 font-[family-name:var(--font-display)] text-base font-black [font-family:inherit] transition-transform disabled:cursor-not-allowed disabled:opacity-35",
                        on ? "border-primary ring-[3px] ring-primary/25" : "border-transparent",
                        unit?.level !== null && unit?.level !== undefined ? levelTones[unit.level] : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {item.number}
                    </button>
                  );
                })}
              </div>
            )}
            <button type="button" className={chunky("ghost", "w-full text-xs")} onClick={() => navigate(studentRoutes.exam)}>
              <Flag size={16} aria-hidden="true" />
              {text.exam}
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
