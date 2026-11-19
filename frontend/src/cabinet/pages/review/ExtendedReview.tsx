import { Bot, Check, ChevronDown, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { gradeTask, returnAssignment, type Assignment } from "../../tasks/library";
import { aiReview, solutionOf, type AiReview } from "../../tasks/reviewAi";
import type { TaskItem } from "../../tasks/types";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { RichText } from "../../ui/RichText";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import styles from "../pages.module.css";

const text = cabinet.teacher.review;
const AI_DELAY_MS = 1100;

type AiState = { kind: "idle" } | { kind: "checking" } | { kind: "done"; review: AiReview };

/** Проверка развёрнутой задачи: решение, разбор ИИ по кнопке и оценка репетитора (REVIEW-3, REVIEW-4). */
export function ExtendedReview({ assignment, task, index }: { assignment: Assignment; task: TaskItem; index: number }) {
  const { notify } = useNotifier();
  const photos = (() => {
    const answer = assignment.attempts.at(-1)?.answers[task.id];
    return answer?.kind === "extended" ? answer.photos : [];
  })();
  const solution = solutionOf(assignment.studentId, task.id, photos);
  const [ai, setAi] = useState<AiState>({ kind: "idle" });
  const [points, setPoints] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [tried, setTried] = useState(false);
  const mistake = ai.kind === "done" ? ai.review.mistake : undefined;

  const runAi = () => {
    setAi({ kind: "checking" });
    setTimeout(() => setAi({ kind: "done", review: aiReview(assignment.studentId, task) }), AI_DELAY_MS);
  };

  const applyAi = (review: AiReview) => {
    if (review.score >= 0) setPoints(review.score);
    if (!comment.trim()) setComment(review.summary);
  };

  const submit = () => {
    if (points === null) return;
    gradeTask(assignment.id, task.id, points, task.points, comment);
    notify(text.grade.graded);
  };

  const rework = () => {
    setTried(true);
    if (!comment.trim()) return;
    returnAssignment(assignment.id, comment);
    notify(text.grade.returned);
  };

  return (
    <section className="grid gap-4 glass rounded-2xl p-5">
      <header className="grid gap-2">
        <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{text.task.title(index, task.points)}</span>
        <p className="m-0 text-base leading-snug font-bold">
          <RichText parts={task.statement} />
        </p>
        {task.answer.kind === "extended" && (
          <div>
            <button
              type="button"
              aria-expanded={criteriaOpen}
              onClick={() => setCriteriaOpen((open) => !open)}
              className="inline-flex appearance-none items-center gap-1 border-0 bg-transparent p-0 text-sm font-bold text-primary [font-family:inherit]"
            >
              {text.task.criteria}
              <ChevronDown size={14} className={cx("transition-transform", criteriaOpen && "rotate-180")} aria-hidden="true" />
            </button>
            {criteriaOpen && <p className="m-0 mt-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-muted-foreground">{task.answer.criteria}</p>}
          </div>
        )}
      </header>

      <div className="grid gap-1.5">
        <span className="flex items-center justify-between text-sm font-bold text-muted-foreground">
          {text.task.solution}
          <span className="text-xs">{text.task.photos(photos.length)}</span>
        </span>
        <div className={styles.photo}>
          {solution.lines.map((line, lineIndex) => (
            <div key={`${line}-${lineIndex}`}>{lineIndex === mistake ? <mark>{line}</mark> : line}</div>
          ))}
        </div>
      </div>

      <div className={cx("grid gap-3 rounded-xl border p-4", ai.kind === "done" && ai.review.score >= 0 ? "border-[var(--cab-lime-border)] bg-[var(--cab-lime-soft)]" : "bg-secondary/40")}>
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-highlight text-highlight-foreground" aria-hidden="true">
            <Bot size={15} />
          </span>
          <b className="text-sm">{ai.kind === "done" ? (ai.review.score >= 0 ? text.ai.suggests(ai.review.score, ai.review.max) : text.ai.unsure) : text.ai.title}</b>
        </div>
        {ai.kind === "idle" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-sm font-semibold text-muted-foreground">{text.ai.idle}</p>
            <Button size="sm" variant="lime" icon={Sparkles} onClick={runAi}>
              {text.ai.check}
            </Button>
          </div>
        )}
        {ai.kind === "checking" && (
          <p className="m-0 flex items-center gap-2 text-sm font-semibold text-muted-foreground" role="status">
            <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {text.ai.checking}
          </p>
        )}
        {ai.kind === "done" && (
          <>
            <p className="m-0 text-sm font-semibold">{ai.review.summary}</p>
            {ai.review.checks.length > 0 && (
              <ul className="m-0 grid list-none gap-1 p-0">
                {ai.review.checks.map((check) => (
                  <li key={check.text} className={cx("flex items-start gap-2 text-sm font-semibold", check.ok ? "text-success" : "text-destructive")}>
                    {check.ok ? <Check size={15} className="mt-0.5 flex-none" aria-hidden="true" /> : <X size={15} className="mt-0.5 flex-none" aria-hidden="true" />}
                    <span className="text-foreground">{check.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {ai.review.score >= 0 && (
                <Button size="sm" variant="primary" onClick={() => applyAi(ai.review)}>
                  {text.ai.apply}
                </Button>
              )}
              <Button size="sm" icon={RotateCcw} onClick={runAi}>
                {text.ai.recheck}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <span className="text-sm font-bold text-muted-foreground">{text.grade.label}</span>
          <ToggleGroup
            type="single"
            spacing={1}
            value={points === null ? "" : String(points)}
            aria-label={text.grade.label}
            className="w-fit max-w-full flex-wrap gap-1 rounded-lg border bg-card p-1"
            onValueChange={(value) => value !== "" && setPoints(Number(value))}
          >
            {Array.from({ length: task.points + 1 }, (_, value) => (
              <ToggleGroupItem key={value} value={String(value)} className="size-9 text-base font-extrabold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {text.grade.points(value)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <label className="grid gap-1.5">
          <span className="text-sm font-bold text-muted-foreground">{text.grade.comment}</span>
          <textarea
            value={comment}
            rows={2}
            maxLength={1000}
            placeholder={text.grade.commentPlaceholder}
            aria-invalid={tried && !comment.trim()}
            onChange={(event) => setComment(event.target.value)}
            className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-base [font-family:inherit] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          {tried && !comment.trim() && <span className="text-sm font-semibold text-destructive">{text.grade.reworkHint}</span>}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={points === null} onClick={submit}>
            {points === null ? text.grade.label : text.grade.submit(points, task.points)}
          </Button>
          <Button onClick={rework}>{text.grade.rework}</Button>
        </div>
      </div>
    </section>
  );
}
