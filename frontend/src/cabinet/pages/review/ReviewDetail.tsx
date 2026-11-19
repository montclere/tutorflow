import { Check, ChevronDown, ClipboardList, X, Zap } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import { formatShortDate } from "../../model/dates";
import { answerText } from "../../tasks/check";
import { attemptScore, pendingTasks, type Assignment, type Work } from "../../tasks/library";
import type { AnswerResponse } from "../../tasks/types";
import { Avatar } from "../../ui/Avatar";
import { cx } from "../../ui/cx";
import { Pill } from "../../ui/Pill";
import { RichText } from "../../ui/RichText";
import { ExtendedReview } from "./ExtendedReview";

const text = cabinet.teacher.review;

function responseText(response: AnswerResponse | undefined): string {
  if (!response) return "—";
  switch (response.kind) {
    case "number":
    case "text":
      return response.value || "—";
    case "choice":
      return response.selected.map((index) => index + 1).sort().join("") || "—";
    case "match":
      return response.pairs.map((pair) => (pair === null ? "?" : pair + 1)).join("");
    case "extended":
      return `${response.photos.length} фото`;
  }
}

function AutoPart({ assignment, work }: { assignment: Assignment; work: Work }) {
  const [open, setOpen] = useState(false);
  const last = assignment.attempts.at(-1);
  if (!last) return null;
  const auto = work.items.filter((task) => task.answer.kind !== "extended");
  if (auto.length === 0) return null;
  const score = attemptScore(work.items, last.results);
  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--cab-ok-soft)] text-success" aria-hidden="true">
            <Check size={18} />
          </span>
          <div className="grid">
            <b className="text-base font-extrabold">{text.auto.title}</b>
            <span className="text-sm font-semibold text-muted-foreground tabular-nums">{text.auto.summary(score.correct, score.total)}</span>
          </div>
        </div>
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="inline-flex appearance-none items-center gap-1 border-0 bg-transparent p-0 text-sm font-bold text-primary [font-family:inherit]">
          {text.auto.toggle}
          <ChevronDown size={14} className={cx("transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
      </div>
      <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-hidden={open}>
        {work.items.map((task, index) => {
          const result = last.results[task.id]?.correct;
          return (
            <li
              key={task.id}
              className={cx(
                "grid size-8 place-items-center rounded-lg text-sm font-extrabold tabular-nums",
                result === true && "bg-[var(--cab-ok-soft)] text-success",
                result === false && "bg-[var(--cab-bad-soft)] text-destructive",
                (result === null || result === undefined) && "bg-secondary text-muted-foreground",
              )}
            >
              {index + 1}
            </li>
          );
        })}
      </ol>
      {open && (
        <ol className="m-0 grid list-none gap-2 p-0">
          {auto.map((task) => {
            const result = last.results[task.id]?.correct;
            return (
              <li key={task.id} className="flex items-start gap-2.5 rounded-lg bg-secondary/50 p-2.5 text-sm">
                {result ? <Check size={16} className="mt-0.5 flex-none text-success" aria-hidden="true" /> : <X size={16} className="mt-0.5 flex-none text-destructive" aria-hidden="true" />}
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-bold">
                    {work.items.indexOf(task) + 1}. <RichText parts={task.statement} />
                  </span>
                  <span className="font-semibold text-muted-foreground">
                    {text.auto.your(responseText(last.answers[task.id]))}
                    {!result && ` · ${text.auto.correct(answerText(task.answer))}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Окно проверки одной работы: автопроверенная часть и развёрнутые задачи (REVIEW-2…4). */
export function ReviewDetail({ assignment, work }: { assignment: Assignment; work: Work }) {
  const student = getStudent(assignment.studentId);
  const last = assignment.attempts.at(-1);
  const pending = pendingTasks(assignment, work);
  const graded = last ? work.items.filter((task) => task.answer.kind === "extended" && last.results[task.id] && last.results[task.id]?.correct !== null) : [];
  const minutes = last ? Math.max(1, Math.round((last.finishedAt - last.startedAt) / 60_000)) : 0;

  return (
    <div className="grid content-start gap-4">
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-5">
        <Avatar initials={student.initials} color={student.color} large />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h2 className="m-0 font-[family-name:var(--font-display)] text-xl font-black">{student.name}</h2>
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
            {work.kind === "test" ? <Zap size={14} aria-hidden="true" /> : <ClipboardList size={14} aria-hidden="true" />}
            {work.title}
            {last && <span className="tabular-nums">· {text.submitted(formatShortDate(new Date(last.finishedAt).toISOString().slice(0, 10)), minutes)}</span>}
          </span>
        </div>
        <Pill tone={assignment.status === "done" ? "ok" : assignment.status === "wait" ? "blue" : "warn"}>{text.status[assignment.status]}</Pill>
      </header>

      {!last ? (
        <p className="m-0 rounded-2xl border border-dashed bg-card p-8 text-center text-sm font-semibold text-muted-foreground">{text.testResult.none}</p>
      ) : (
        <>
          <AutoPart assignment={assignment} work={work} />
          {pending.map((task) => (
            <ExtendedReview key={`${assignment.id}-${task.id}`} assignment={assignment} task={task} index={work.items.indexOf(task) + 1} />
          ))}
          {graded.map((task) => (
            <section key={task.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 text-sm">
              <Check size={16} className="text-success" aria-hidden="true" />
              <b>{text.task.title(work.items.indexOf(task) + 1, task.points)}</b>
              <span className="font-semibold text-muted-foreground">{text.grade.done(last.results[task.id]?.points ?? 0, task.points)}</span>
              {assignment.feedback?.[task.id] && <span className="w-full font-semibold">«{assignment.feedback[task.id]}»</span>}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
