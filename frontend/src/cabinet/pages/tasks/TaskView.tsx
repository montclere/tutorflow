import { BadgeCheck, CircleAlert, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { taskPlace } from "../../tasks/catalog";
import { tasksText as text } from "../../tasks/tasks.ru";
import type { AnswerSpec, TaskItem } from "../../tasks/types";
import { cx } from "../../ui/cx";
import { RichText } from "../../ui/RichText";

function Answer({ spec }: { spec: AnswerSpec }) {
  switch (spec.kind) {
    case "number":
    case "text":
      return (
        <p className="m-0 w-fit rounded-md bg-secondary px-2 py-1 text-xs font-bold text-muted-foreground tabular-nums">
          {text.answer}: {spec.kind === "number" ? spec.value : spec.values.join(" / ")}
        </p>
      );
    case "choice":
      return (
        <ol className="m-0 grid list-none gap-1 p-0">
          {spec.options.map((option, index) => {
            const correct = spec.correct.includes(index);
            return (
              <li key={option} className={cx("flex items-start gap-2 rounded-md px-2 py-1 text-sm font-semibold", correct ? "bg-[var(--cab-ok-soft)] text-success" : "text-muted-foreground")}>
                <b className="w-4 flex-none tabular-nums">{index + 1}</b>
                <span className="min-w-0 flex-1">{option}</span>
                {correct && <span className="sr-only">{text.correct}</span>}
              </li>
            );
          })}
        </ol>
      );
    case "match":
      return (
        <ul className="m-0 grid list-none gap-1 p-0 text-sm font-semibold">
          {spec.left.map((left, index) => (
            <li key={left} className="flex flex-wrap gap-x-2">
              <b>{String.fromCharCode(0x0410 + index)}) {left}</b>
              <span className="text-muted-foreground">→ {spec.right[spec.pairs[index] ?? 0]}</span>
            </li>
          ))}
        </ul>
      );
    case "extended":
      return (
        <p className="m-0 rounded-md bg-secondary px-2.5 py-1.5 text-xs leading-relaxed font-semibold text-muted-foreground">
          <b>{text.criteria}:</b> {spec.criteria}
        </p>
      );
  }
}

const dots = (level: number) => "●".repeat(level) + "○".repeat(3 - level);

/** Карточка задачи у репетитора: где она в экзамене, тип ответа, баллы, источник и проверен ли ответ. */
export function TaskView({ task, index, tools, compact }: { task: TaskItem; index?: number; tools?: ReactNode; compact?: boolean }) {
  return (
    <article className="grid min-w-0 gap-3 rounded-xl border bg-card p-4 transition-[border-color,box-shadow] duration-150 hover:border-primary/40 motion-reduce:transition-none">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-bold">
          {index !== undefined && <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground tabular-nums">{index}</span>}
          <span className="rounded-md bg-accent px-2 py-1 text-accent-foreground">{taskPlace(task)}</span>
          <span className="rounded-md bg-secondary px-2 py-1 text-muted-foreground">
            {text.answerKinds[task.answer.kind]} · {text.points(task.points)}
          </span>
          <span className="px-1 tracking-widest text-muted-foreground" title={text.difficulty[task.difficulty]} aria-label={text.difficulty[task.difficulty]}>
            {dots(task.difficulty)}
          </span>
        </div>
        {tools && <div className="flex flex-wrap gap-1.5">{tools}</div>}
      </div>
      <div className={cx("leading-snug font-bold", compact ? "text-sm" : "text-base")}>
        <RichText parts={task.statement} />
      </div>
      <Answer spec={task.answer} />
      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2.5 text-xs font-semibold text-muted-foreground">
        {task.source === "ai" ? <Sparkles size={13} className="text-primary" aria-hidden="true" /> : null}
        <span>
          {task.topic} · {task.sourceLabel}
        </span>
        {task.answer.kind !== "extended" && (
          <span className={cx("inline-flex items-center gap-1", task.verified ? "text-success" : "text-[var(--cab-warn)]")}>
            {task.verified ? <BadgeCheck size={13} aria-hidden="true" /> : <CircleAlert size={13} aria-hidden="true" />}
            {task.verified ? text.verified : text.unverified}
          </span>
        )}
      </p>
    </article>
  );
}
