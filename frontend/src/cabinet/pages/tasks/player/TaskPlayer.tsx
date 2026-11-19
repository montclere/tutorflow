import { ArrowLeft, ArrowRight, Check, Clock, Flag, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { navigate } from "../../../../app/router";
import { studentRoutes } from "../../../../config/routes";
import { taskPlace } from "../../../tasks/catalog";
import { answerText, checkAnswer, emptyResponse, isAnswered } from "../../../tasks/check";
import { attemptScore, submitAttempt, type Assignment, type Attempt, type Work } from "../../../tasks/library";
import { tasksText } from "../../../tasks/tasks.ru";
import type { AnswerResponse, TaskItem } from "../../../tasks/types";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";
import { useNotifier } from "../../../ui/Notifications";
import { RichText } from "../../../ui/RichText";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/kit/dialog";
import { AnswerInput } from "./AnswerInput";

const text = tasksText.player;

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
  const score = attemptScore(work.items, attempt.results);
  const minutes = Math.max(1, Math.round((attempt.finishedAt - attempt.startedAt) / 60_000));
  const reveal = (work.kind === "test" && work.test?.mode === "training") || assignment.reveal === "now";
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6 p-5 sm:p-8">
      <div className="grid justify-items-center gap-2 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-highlight text-highlight-foreground" aria-hidden="true">
          <Sparkles size={28} />
        </span>
        <h3 className="m-0 font-[family-name:var(--font-display)] text-2xl font-black">{text.resultTitle}</h3>
        {score.percent !== null && <b className="font-[family-name:var(--font-display)] text-6xl leading-none font-black tabular-nums">{score.percent}%</b>}
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
          <Button
            variant="lime"
            icon={Sparkles}
            onClick={() => {
              onClose();
              navigate(studentRoutes.trainer);
            }}
          >
            {text.practice}
          </Button>
        )}
        <Button variant="primary" onClick={onClose}>
          {text.done}
        </Button>
      </div>
    </div>
  );
}

function Player({ work, assignment, startedAt, onClose }: { work: Work; assignment: Assignment; startedAt: number; onClose: () => void }) {
  const { notify } = useNotifier();
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
    setAttempt(submitAttempt(assignment.id, work.items, answers, startedAt, Date.now()));
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
    <div className="flex min-h-0 flex-1 flex-col">
      <nav aria-label={text.navLabel} className="flex shrink-0 gap-1.5 overflow-x-auto border-b px-5 py-3 sm:px-6">
        {work.items.map((item, position) => {
          const state = stateOf(item, position);
          return (
            <button
              key={item.id}
              type="button"
              aria-current={position === index ? "step" : undefined}
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
              )}
            >
              {position + 1}
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto grid w-full max-w-2xl gap-6 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-md bg-accent px-2 py-1 text-accent-foreground">{taskPlace(task)}</span>
            <span className="rounded-md bg-secondary px-2 py-1 text-muted-foreground">{tasksText.points(task.points)}</span>
          </div>
          <p className="m-0 text-xl leading-snug font-bold">
            <RichText parts={task.statement} />
          </p>
          <AnswerInput key={task.id} spec={task.answer} value={answer} locked={training && isChecked} onChange={(next) => setAnswers((current) => ({ ...current, [task.id]: next }))} onSubmit={primary} />
          {training && isChecked && result !== null && result !== undefined && (
            <div className={cx("grid gap-1 rounded-xl p-4", result ? "bg-[var(--cab-ok-soft)]" : "bg-[var(--cab-bad-soft)]")} role="status">
              <b className={cx("flex items-center gap-2 text-base", result ? "text-success" : "text-destructive")}>
                {result ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
                {result ? text.right : text.wrong}
              </b>
              {!result && <span className="text-sm font-bold">{text.correctAnswer(answerText(task.answer))}</span>}
              {task.solution && (
                <span className="text-sm font-semibold">
                  <b>{text.solution}:</b> {task.solution}
                </span>
              )}
            </div>
          )}
        </article>
      </div>

      <footer className="grid shrink-0 gap-2 border-t px-5 py-3 sm:px-6">
        {confirming && (
          <p className="m-0 text-sm font-bold text-[var(--cab-warn)]" role="alert">
            {text.finishConfirm(unanswered)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={ArrowLeft} disabled={index === 0} onClick={() => go(index - 1)}>
            {text.back}
          </Button>
          <Button icon={Flag} onClick={() => setFlagged((current) => (current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id]))}>
            {flagged.includes(task.id) ? text.unflag : text.flag}
          </Button>
          <span className="flex-1 max-[520px]:hidden" />
          {!last && !training && (
            <Button
              onClick={() => {
                if (unanswered > 0 && !confirming) setConfirming(true);
                else finish();
              }}
            >
              {text.finish}
            </Button>
          )}
          <Button
            variant="primary"
            className="max-[520px]:order-first max-[520px]:h-11 max-[520px]:basis-full"
            onClick={primary}
            disabled={training && !isChecked && task.answer.kind !== "extended" && !isAnswered(answer)}
          >
            {primaryLabel}
            {!last && primaryLabel === text.next && <ArrowRight aria-hidden="true" />}
          </Button>
        </div>
      </footer>
      {left !== null && <span className="sr-only">{text.timeLeft(clock(left))}</span>}
    </div>
  );
}

/** Шапка и плеер одной попытки: создаются заново при каждом открытии, время отсчитывается от него. */
function Shell({ work, assignment, onClose }: { work: Work; assignment: Assignment; onClose: () => void }) {
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
      <header className="flex shrink-0 items-center gap-3 border-b px-5 py-3 sm:px-6">
        <div className="grid min-w-0 flex-1">
          <DialogTitle className="m-0 truncate font-[family-name:var(--font-display)] text-lg font-black">{work.title}</DialogTitle>
          <DialogDescription className="m-0 text-sm font-semibold">
            {tasksText.kinds[work.kind]}
            {work.kind === "test" && work.test ? ` · ${tasksText.save.modes[work.test.mode]}` : ""} · {tasksText.count(work.items.length)}
          </DialogDescription>
        </div>
        {limit !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-extrabold tabular-nums" aria-hidden="true">
            <Clock size={15} />
            {clock(limit * 60 - (now - startedAt) / 1000)}
          </span>
        )}
        <Button icon={X} aria-label={`${text.close}. ${text.closeHint}`} title={text.closeHint} onClick={onClose} />
      </header>
      <Player work={work} assignment={assignment} startedAt={startedAt} onClose={onClose} />
    </>
  );
}

/** Решение задания или теста на платформе — окно на весь экран (TASKS-8). */
export function TaskPlayer({ assignment, work, onClose }: Props) {
  return (
    <Dialog open={assignment !== null && work !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:max-w-none"
      >
        {assignment && work && <Shell key={assignment.id} work={work} assignment={assignment} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
