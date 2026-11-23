import { ArrowRight, BookOpen, Check, CheckCheck, Flag, Flame, Target, TrendingUp, X } from "lucide-react";
import { useRef, useState } from "react";
import { navigate, useSearch } from "../../app/router";
import { studentRoutes } from "../../config/routes";
import { demoStudentId } from "../mocks/student";
import { examOf, subjectOf } from "../tasks/catalog";
import { answerText, checkAnswer, emptyResponse, isAnswered } from "../tasks/check";
import { goals, useStudentProgress } from "../tasks/learner";
import { pickTask, practiceNumbers, recordPractice, SESSION_LENGTH, usePractice, type PracticeMode } from "../tasks/practice";
import type { AnswerResponse, TaskItem } from "../tasks/types";
import { cx } from "../ui/cx";
import { trainerRecommendations } from "../model/trainer";
import { growthShare } from "../model/studentHome";
import ui from "./trainer/trainer.module.css";
import { RichText } from "../ui/RichText";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { chunky } from "./learn/chunky";
import styles from "./learn/learn.module.css";
import { learnText } from "./learn/learn.ru";
import { AnswerInput } from "./tasks/player/AnswerInput";

const text = learnText.trainer;
const levelTones = ["bg-[var(--cab-bad-soft)] text-destructive", "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]", "bg-[var(--cab-lime-soft)] text-foreground", "bg-[var(--cab-ok-soft)] text-success"];
const modes: PracticeMode[] = ["weak", "number", "mistakes"];

type Session = { index: number; right: number; recent: string[]; task: TaskItem | null; answer: AnswerResponse | null; result: boolean | null; done: boolean };

function newSession(): Session {
  return { index: 0, right: 0, recent: [], task: null, answer: null, result: null, done: false };
}

/** Тренажёр: задачи с мгновенной проверкой, сессии по 10 и мини-мониторинг — без опыта и серий (STUDENT-5). */
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
  const numbersRef = useRef<HTMLDivElement>(null);
  const recommendations = trainerRecommendations(progress?.units ?? [], available);
  const subject = examOf(exam)?.subject;
  const subjectLabel = subject ? subjectOf(subject).label : progress?.title;
  const canStart = mode === "mistakes" ? practice.mistakes.length > 0 : mode === "number" ? number !== undefined && available.has(number) : available.size > 0;
  const weak = progress?.weak.map((unit) => unit.number).filter((value): value is number => value !== undefined) ?? [];

  const pick = (current: Session, seed: number): TaskItem | null => pickTask(mode, { exam, number, weak: weak.length > 0 ? weak : [...available], seed, recent: current.recent });

  const start = (selectedNumber?: number) => {
    const fresh = newSession();
    if (selectedNumber !== undefined) {
      setMode("number");
      setNumber(selectedNumber);
    }
    const task = selectedNumber === undefined ? pick(fresh, Date.now()) : pickTask("number", { exam, number: selectedNumber, weak, seed: Date.now(), recent: [] });
    setSession({ ...fresh, task, answer: task ? emptyResponse(task.answer) : null });
  };

  const check = () => {
    if (!session.task || !session.answer || !isAnswered(session.answer)) return;
    const correct = checkAnswer(session.task.answer, session.answer) === true;
    recordPractice(session.task, correct);
    setSession({ ...session, result: correct, right: session.right + Number(correct) });
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

  const running = session.task !== null && !session.done;

  return (
    <div className={ui.root}>
      <header className={ui.heading}><h1>{text.title}</h1></header>
      <div className={ui.grid}>
        <div className={ui.main}>
        <section className={running || session.done ? ui.session : ui.hero} aria-label={running || session.done ? text.title : undefined}>
          {session.done ? (
            <div className="grid place-items-center gap-4 p-8 text-center">
              <span className={cx("grid size-24 place-items-center rounded-full bg-[var(--cab-ok-soft)] text-success", styles.pop)} aria-hidden="true">
                <CheckCheck size={40} />
              </span>
              <h2 className="m-0 font-[family-name:var(--font-display)] text-2xl font-black">{text.finishTitle}</h2>
              <p className="m-0 text-lg font-bold tabular-nums">{text.finishScore(session.right, SESSION_LENGTH)}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" className={chunky("primary")} onClick={() => start()}>
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
                    <span className="text-sm font-bold">{session.result ? text.rightNote : text.correctAnswer(answerText(session.task.answer))}</span>
                  </div>
                  <button type="button" className={chunky(session.result ? "good" : "bad", "max-[520px]:w-full")} onClick={next}>
                    {text.next}
                  </button>
                </footer>
              )}
            </>
          ) : (
            <>
              <div className={ui.heroCopy}>
                <h2>{text.heroTitle}</h2>
                <p>{text.heroNote}</p>
                <button type="button" className={ui.primary} disabled={!canStart} onClick={() => start()}>
                  {text.start}<ArrowRight size={20} aria-hidden="true" />
                </button>
                {!canStart && <p className={ui.empty} role="status">{mode === "mistakes" ? text.emptyMistakes : available.size === 0 ? text.noBank : text.noNumber}</p>}
              </div>
              <picture className={ui.art}>
                <source srcSet="/student-trainer/target-600.webp 600w, /student-trainer/target.webp 1200w" sizes="(max-width: 600px) 240px, (max-width: 1200px) 320px, 440px" type="image/webp" />
                <img src="/student-trainer/target.webp" width="1200" height="675" alt="" decoding="async" />
              </picture>
            </>
          )}
        </section>
        {!running && !session.done && (
          <section className={ui.recommendations} aria-labelledby="trainer-recommendations">
            <div className={ui.sectionHeading}>
              <span className={ui.flame} aria-hidden="true"><Flame size={23} /></span>
              <h2 id="trainer-recommendations">{text.recommendations}</h2>
              <button type="button" className={ui.textButton} onClick={() => {
                changeMode("number");
                requestAnimationFrame(() => numbersRef.current?.focus());
              }}>{text.allTraining}<ArrowRight size={18} aria-hidden="true" /></button>
            </div>
            {recommendations.length > 0 ? <ul className={ui.recommendationList}>
              {recommendations.map((unit) => <li key={unit.key}>
                <button type="button" className={ui.recommendation} aria-label={text.practiceNumber(unit.number)} onClick={() => start(unit.number)}>
                  <span className={ui.topicIcon} aria-hidden="true"><BookOpen size={25} /></span>
                  <span className={ui.topic}><b>{subjectLabel}</b><span>{text.taskNumber(unit.number)} · {unit.label}</span></span>
                  <span className={ui.progressRow}>
                    {unit.total > 0 ? <><span className={ui.progressTrack} aria-hidden="true"><span style={{ width: `${growthShare(unit)}%` }} /></span><b>{growthShare(unit)}%</b></> : <span>{text.notStudied}</span>}
                  </span>
                </button>
              </li>)}
            </ul> : <p className={ui.empty}>{text.emptyRecommendations}</p>}
          </section>
        )}
        </div>
        <aside className={ui.aside}>
          {/* Мини-мониторинг: сколько решено за неделю, точность и готовность — без целей, серий и опыта. */}
          <section className={ui.metrics} aria-label={text.monitorLabel}>
            {[
              { icon: CheckCheck, value: String(practice.weekSolved), label: text.weekLabel },
              { icon: Target, value: progress?.accuracy === null || progress?.accuracy === undefined ? "—" : `${progress.accuracy}%`, label: text.accuracyLabel },
              { icon: TrendingUp, value: progress ? `${progress.readiness}%` : "—", label: text.readinessLabel },
            ].map((item) => (
              <div key={item.label} className={ui.metric}>
                <span className={ui.metricIcon} aria-hidden="true">
                  <item.icon size={20} />
                </span>
                <b className={ui.metricValue}>{item.value}</b>
                <span className={ui.metricLabel}>{item.label}</span>
              </div>
            ))}
          </section>

          <section className={ui.controls}>
            <ToggleGroup type="single" spacing={1} value={mode} aria-label={text.modesLabel} className={ui.modes} onValueChange={(value) => value && changeMode(value as PracticeMode)}>
              {modes.map((item) => (
                <ToggleGroupItem key={item} value={item} className={ui.mode}>
                  {text.modes[item]}
                  {item === "mistakes" && practice.mistakes.length > 0 ? ` · ${practice.mistakes.length}` : ""}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {mode === "number" && (
              <div ref={numbersRef} tabIndex={-1} className={ui.numbers} role="radiogroup" aria-label={text.numbersLabel}>
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
            {(mode !== "weak" || !canStart) && <p className={ui.modeHint} role="status">{!canStart ? mode === "mistakes" ? text.emptyMistakes : available.size === 0 ? text.noBank : text.noNumber : text.modeHints[mode]}</p>}
            <button type="button" className={ui.exam} onClick={() => navigate(studentRoutes.exam)}>
              <Flag size={16} aria-hidden="true" />
              {text.exam}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
