import { ArrowLeft, ArrowRight, Bookmark, Check, CheckCheck, Clock, Flag, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { navigate } from "../../../../app/router";
import { studentRoutes } from "../../../../config/routes";
import { taskPlace } from "../../../tasks/catalog";
import { answerText, checkAnswer, emptyResponse, isAnswered } from "../../../tasks/check";
import { attemptScore, submitAttempt, type Assignment, type Attempt, type Work } from "../../../tasks/library";
import { tasksText } from "../../../tasks/tasks.ru";
import type { AnswerResponse, TaskItem } from "../../../tasks/types";
import { Button } from "../../../ui/Button";
import { chunky } from "../../learn/chunky";
import learn from "../../learn/learn.module.css";
import { cx } from "../../../ui/cx";
import { useNotifier } from "../../../ui/Notifications";
import { RichText } from "../../../ui/RichText";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/kit/dialog";
import { AnswerInput } from "./AnswerInput";
import styles from "./test-modal.module.css";

const text = tasksText.player;

const PRAISE = ["Отлично!", "Верно!", "Так держать!", "Супер!"];
const praise = (index: number) => PRAISE[index % PRAISE.length] ?? PRAISE[0];

function clock(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}

function responseText(response: AnswerResponse | undefined): string {
  if (!response || !isAnswered(response)) return "—";
  switch (response.kind) {
    case "number":
    case "text":
      return response.value;
    case "choice":
      return response.selected.map((index) => index + 1).sort().join("");
    case "match":
      return response.pairs.map((pair) => (pair === null ? "?" : pair + 1)).join("");
    case "extended":
      return response.photos.join(", ");
  }
}

type Props = { assignment: Assignment | null; work: Work | null; onClose: () => void };

function Result({ work, assignment, attempt, onClose }: { work: Work; assignment: Assignment; attempt: Attempt; onClose: () => void }) {
  const modern = work.kind === "test";
  const score = attemptScore(work.items, attempt.results);
  const minutes = Math.max(1, Math.round((attempt.finishedAt - attempt.startedAt) / 60_000));
  const reveal = (work.kind === "test" && work.test?.mode === "training") || assignment.reveal === "now";
  return (
    <div className={cx("mx-auto grid w-full max-w-2xl gap-6 p-5 sm:p-8", modern && styles.result)}>
      <div className="grid justify-items-center gap-2 text-center">
        <span className={cx("grid size-20 place-items-center rounded-full bg-[var(--cab-ok-soft)] text-success", learn.pop)} aria-hidden="true">
          <CheckCheck size={34} />
        </span>
        <h3 className="m-0 font-[family-name:var(--font-display)] text-2xl font-black">{text.resultTitle}</h3>
        {score.percent !== null && <b className={cx("font-[family-name:var(--font-display)] text-6xl leading-none font-black tabular-nums", modern && styles.resultPercent)}>{score.percent}%</b>}
        <p className="m-0 text-base font-semibold text-muted-foreground tabular-nums">
          {[score.total > 0 ? text.resultScore(score.correct, score.total) : null, text.resultPoints(score.points, score.maxPoints), text.resultTime(minutes)].filter(Boolean).join(" · ")}
        </p>
        {score.pending > 0 && <p className="m-0 rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">{text.resultPending(score.pending)}</p>}
      </div>

      <section className="grid gap-2">
        <h4 className="m-0 text-sm font-bold tracking-wide text-muted-foreground uppercase">{text.reviewTitle}</h4>
        {!reveal && <p className="m-0 text-sm font-semibold text-muted-foreground">{text.answersLater[assignment.reveal === "afterDue" ? "afterDue" : "afterCheck"]}</p>}
        <ol className="m-0 grid list-none gap-2 p-0">
          {work.items.map((task, index) => {
            const result = attempt.results[task.id]?.correct;
            return (
              <li key={task.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                <span
                  className={cx(
                    "grid size-7 flex-none place-items-center rounded-full text-sm font-extrabold",
                    !reveal || result === null ? "bg-secondary text-muted-foreground" : result ? "bg-[var(--cab-ok-soft)] text-success" : "bg-[var(--cab-bad-soft)] text-destructive",
                  )}
                  aria-label={!reveal || result === null ? undefined : result ? text.states.right : text.states.wrong}
                >
                  {!reveal || result === null ? index + 1 : result ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
                </span>
                <div className="grid min-w-0 flex-1 gap-1 text-sm">
                  <span className="font-bold">
                    <RichText parts={task.statement} />
                  </span>
                  <span className="font-semibold text-muted-foreground">{text.yourAnswer(responseText(attempt.answers[task.id]))}</span>
                  {reveal && result === false && <span className="font-bold text-success">{text.correctAnswer(answerText(task.answer))}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-wrap justify-center gap-2">
        {score.correct < score.total && (
          <button
            type="button"
            className={modern ? styles.secondary : chunky("lime")}
            onClick={() => {
              onClose();
              navigate(studentRoutes.trainer);
            }}
          >
            <Sparkles size={18} aria-hidden="true" />
            {text.practice}
          </button>
        )}
        <button type="button" className={modern ? styles.primary : chunky("primary")} onClick={onClose}>
          {text.done}
        </button>
      </div>
    </div>
  );
}

function Player({ work, assignment, startedAt, onClose }: { work: Work; assignment: Assignment; startedAt: number; onClose: () => void }) {
  const { notify } = useNotifier();
  const modern = work.kind === "test";
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerResponse>>(() => Object.fromEntries(work.items.map((task) => [task.id, emptyResponse(task.answer)])));
  const [flagged, setFlagged] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean | null>>({});
  const [confirming, setConfirming] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [now, setNow] = useState(startedAt);
  const finishedRef = useRef(false);

  const training = work.kind === "test" && work.test?.mode === "training";
  const limit = work.kind === "test" ? (work.test?.timeLimitMin ?? null) : null;
  const left = limit === null ? null : limit * 60 - (now - startedAt) / 1000;
  const task = work.items[index] as TaskItem;
  const answer = answers[task.id] ?? emptyResponse(task.answer);
  const isChecked = task.id in checked;
  const last = index === work.items.length - 1;
  const unanswered = work.items.filter((item) => !isAnswered(answers[item.id])).length;

  const finish = (timeUp = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const submitted = submitAttempt(assignment.id, work.items, answers, startedAt, Date.now());
    setAttempt(submitted);
    notify(timeUp ? text.timeUp : text.sent);
  };

  useEffect(() => {
    if (limit === null || attempt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [limit, attempt]);

  useEffect(() => {
    // Время вышло — отправляем то, что есть.
    if (left !== null && left <= 0) finish(true);
    // finish стабилен по смыслу: повторный вызов отсекает finishedRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  if (attempt) return <Result work={work} assignment={assignment} attempt={attempt} onClose={onClose} />;

  const go = (next: number) => {
    setConfirming(false);
    setIndex(Math.max(0, Math.min(work.items.length - 1, next)));
  };

  const check = () => {
    if (!isAnswered(answer)) return;
    setChecked((current) => ({ ...current, [task.id]: checkAnswer(task.answer, answer) }));
  };

  const primary = () => {
    if (training && !isChecked && task.answer.kind !== "extended") {
      check();
      return;
    }
    if (last) {
      if (unanswered > 0 && !confirming) setConfirming(true);
      else finish();
      return;
    }
    go(index + 1);
  };

  const stateOf = (item: TaskItem, position: number) => {
    if (item.id in checked && checked[item.id] !== null) return checked[item.id] ? "right" : "wrong";
    if (position === index) return "current";
    if (flagged.includes(item.id)) return "flagged";
    return isAnswered(answers[item.id]) ? "answered" : "empty";
  };

  const result = checked[task.id];
  const primaryLabel = training && !isChecked && task.answer.kind !== "extended" ? text.check : last ? text.finish : text.next;

  return (
    <div className={cx("flex min-h-0 flex-1 flex-col", modern && styles.player)}>
      <div className={cx("shrink-0 px-5 pt-4 sm:px-6", modern && styles.progressWrap)}>
        <div className={learn.bar} role="progressbar" aria-valuemin={0} aria-valuemax={work.items.length} aria-valuenow={work.items.length - unanswered} aria-label={text.progress(work.items.length - unanswered, work.items.length)}>
          <div className={learn.barFill} style={{ width: `${((work.items.length - unanswered) / work.items.length) * 100}%` }} />
        </div>
      </div>
      <nav aria-label={text.navLabel} className={cx("flex shrink-0 gap-1.5 overflow-x-auto border-b px-5 py-3 sm:px-6", modern && styles.steps)}>
        {work.items.map((item, position) => {
          const state = stateOf(item, position);
          return (
            <button
              key={item.id}
              type="button"
              aria-current={position === index ? "step" : undefined}
              data-state={modern ? state : undefined}
              aria-label={text.navItem(position + 1, text.states[state])}
              onClick={() => go(position)}
              className={cx(
                "relative grid size-9 flex-none appearance-none place-items-center rounded-full border-2 text-sm font-extrabold [font-family:inherit] transition-colors tabular-nums",
                state === "current" && "border-primary bg-primary text-primary-foreground",
                state === "answered" && "border-primary/40 bg-accent text-accent-foreground",
                state === "empty" && "border-border bg-card text-muted-foreground",
                state === "flagged" && "border-[var(--cab-warn)] bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]",
                state === "right" && "border-success bg-[var(--cab-ok-soft)] text-success",
                state === "wrong" && "border-destructive bg-[var(--cab-bad-soft)] text-destructive",
                position === index && state !== "current" && "ring-[3px] ring-ring/40",
                modern && styles.step,
              )}
            >
              {position + 1}
            </button>
          );
        })}
        {modern && <span className={styles.stepCount}>{text.progress(index + 1, work.items.length)}</span>}
      </nav>

      <div className={cx("min-h-0 flex-1 overflow-y-auto", modern && styles.body)}>
        <article key={`${task.id}-${isChecked}`} className={cx("mx-auto grid w-full max-w-2xl gap-6 p-5 sm:p-8", training && isChecked && result === false && learn.shake, modern && styles.question)}>
          <div className={cx("flex flex-wrap items-center gap-2 text-xs font-bold", modern && styles.tags)}>
            <span className="rounded-md bg-accent px-2 py-1 text-accent-foreground">{taskPlace(task)}</span>
            <span className="rounded-md bg-secondary px-2 py-1 text-muted-foreground">{tasksText.points(task.points)}</span>
          </div>
          <p className={cx("m-0 text-xl leading-snug font-bold", modern && styles.statement)}>
            <RichText parts={task.statement} />
          </p>
          <AnswerInput key={task.id} appearance={modern ? "test-modal" : undefined} spec={task.answer} value={answer} locked={training && isChecked} onChange={(next) => setAnswers((current) => ({ ...current, [task.id]: next }))} onSubmit={primary} />
        </article>
      </div>

      {training && isChecked && result !== null && result !== undefined ? (
        <footer className={cx("grid shrink-0 gap-3 px-5 py-4 sm:px-6", learn.slideUp, result ? "bg-[var(--cab-ok-soft)]" : "bg-[var(--cab-bad-soft)]", modern && styles.footer, modern && styles.feedback)} data-outcome={modern ? result ? "right" : "wrong" : undefined} role="status">
          <div className={cx("mx-auto flex w-full max-w-2xl flex-wrap items-center gap-4", modern && styles.feedbackInner)}>
            <span className={cx("grid size-12 flex-none place-items-center rounded-full bg-card", result ? "text-success" : "text-destructive", learn.pop, modern && styles.feedbackIcon)} aria-hidden="true">
              {result ? <Check size={26} /> : <X size={26} />}
            </span>
            <div className={cx("grid min-w-0 flex-1 gap-0.5", modern && styles.feedbackCopy)}>
              <b className={cx("font-[family-name:var(--font-display)] text-xl font-black", result ? "text-success" : "text-destructive")}>{result ? praise(index) : text.wrong}</b>
              {!result && <span className="text-sm font-bold">{text.correctAnswer(answerText(task.answer))}</span>}
              {task.solution && (
                <span className="text-sm font-semibold">
                  <b>{text.solution}:</b> {task.solution}
                </span>
              )}
            </div>
            <button type="button" className={modern ? styles.primary : chunky(result ? "good" : "bad", "max-[520px]:w-full")} onClick={primary}>
              {last ? text.finish : text.next}
            </button>
          </div>
        </footer>
      ) : (
        <footer className={cx("grid shrink-0 gap-2 border-t px-5 py-3 sm:px-6", modern && styles.footer)}>
        {confirming && (
          <p className="m-0 text-sm font-bold text-[var(--cab-warn)]" role="alert">
            {text.finishConfirm(unanswered)}
          </p>
        )}
        <div className={cx("flex flex-wrap items-center gap-2", modern && styles.footerControls)}>
          <Button className={modern ? styles.secondary : undefined} icon={ArrowLeft} disabled={index === 0} onClick={() => go(index - 1)}>
            {text.back}
          </Button>
          <Button className={modern ? styles.secondary : undefined} icon={modern ? Bookmark : Flag} aria-pressed={modern ? flagged.includes(task.id) : undefined} onClick={() => setFlagged((current) => (current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id]))}>
            {flagged.includes(task.id) ? text.unflag : text.flag}
          </Button>
          <span className={cx("flex-1 max-[520px]:hidden", modern && styles.spacer)} />
          {!last && !training && (
            <Button
              className={modern ? styles.secondary : undefined}
              onClick={() => {
                if (unanswered > 0 && !confirming) setConfirming(true);
                else finish();
              }}
            >
              {text.finish}
            </Button>
          )}
          <button
            type="button"
            className={modern ? styles.primary : chunky(primaryLabel === text.check ? "good" : "primary", "max-[520px]:order-first max-[520px]:basis-full")}
            onClick={primary}
            disabled={training && !isChecked && task.answer.kind !== "extended" && !isAnswered(answer)}
          >
            {primaryLabel}
            {!last && primaryLabel === text.next && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </div>
        </footer>
      )}
      {left !== null && <span className="sr-only">{text.timeLeft(clock(left))}</span>}
    </div>
  );
}

/** Шапка и плеер одной попытки: создаются заново при каждом открытии, время отсчитывается от него. */
function Shell({ work, assignment, onClose }: { work: Work; assignment: Assignment; onClose: () => void }) {
  const modern = work.kind === "test";
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const limit = work.kind === "test" ? (work.test?.timeLimitMin ?? null) : null;

  useEffect(() => {
    if (limit === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [limit]);

  return (
    <>
      <header className={cx("flex shrink-0 items-center gap-3 border-b px-5 py-3 sm:px-6", modern && styles.header)}>
        <div className={cx("grid min-w-0 flex-1", modern && styles.headerCopy)}>
          <DialogTitle className={cx("m-0 truncate font-[family-name:var(--font-display)] text-lg font-black", modern && styles.title)}>{work.title}</DialogTitle>
          <DialogDescription className={cx("m-0 text-sm font-semibold", modern && styles.meta)}>
            {tasksText.kinds[work.kind]}
            {work.kind === "test" && work.test ? ` · ${tasksText.save.modes[work.test.mode]}` : ""} · {tasksText.count(work.items.length)}
          </DialogDescription>
        </div>
        {modern && <picture className={styles.decor}>
          <source srcSet="/student-test-modal/flashcards-400.webp 400w, /student-test-modal/flashcards.webp 800w" sizes="140px" type="image/webp" />
          <img src="/student-test-modal/flashcards.webp" width="800" height="600" alt="" decoding="async" />
        </picture>}
        {limit !== null && (
          <span className={cx("inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-extrabold tabular-nums", modern && styles.timer)} aria-hidden="true">
            <Clock size={15} />
            {clock(limit * 60 - (now - startedAt) / 1000)}
          </span>
        )}
        <Button className={modern ? styles.close : undefined} icon={X} aria-label={`${text.close}. ${text.closeHint}`} title={text.closeHint} onClick={onClose} />
      </header>
      <Player work={work} assignment={assignment} startedAt={startedAt} onClose={onClose} />
    </>
  );
}

/** Решение задания или теста на платформе — окно на весь экран (TASKS-8). */
export function TaskPlayer({ assignment, work, onClose }: Props) {
  const triggerRef = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={assignment !== null && work !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cx("top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:max-w-none", work?.kind === "test" && styles.modal)}
        onOpenAutoFocus={() => {
          triggerRef.current = work?.kind === "test" && document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          const trigger = triggerRef.current;
          if (!trigger) return;
          event.preventDefault();
          triggerRef.current = null;
          if (trigger.isConnected && !trigger.matches(":disabled")) trigger.focus();
          else document.getElementById("cabinet-main")?.focus();
        }}
      >
        {assignment && work && <Shell key={assignment.id} work={work} assignment={assignment} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
