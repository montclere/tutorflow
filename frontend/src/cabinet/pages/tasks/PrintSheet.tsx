import { useEffect } from "react";
import { createPortal } from "react-dom";
import { formatShortDate } from "../../model/dates";
import { taskPlace } from "../../tasks/catalog";
import { answerText, estimateMinutes } from "../../tasks/check";
import { clearPrint, usePrintJob, type PrintJob } from "../../tasks/print";
import { tasksText } from "../../tasks/tasks.ru";
import type { TaskItem } from "../../tasks/types";
import { RichText } from "../../ui/RichText";
import "./print.css";

const text = tasksText.print.sheet;
const CELLS = 12;
const LINES = 7;

const Cells = () => (
  <span className="pr-cells" aria-hidden="true">
    {Array.from({ length: CELLS }, (_, index) => (
      <i key={index} />
    ))}
  </span>
);

function TaskBlock({ task, index, withAnswers }: { task: TaskItem; index: number; withAnswers: boolean }) {
  const { answer } = task;
  return (
    <li className="pr-task">
      <span className="pr-num">{index}.</span>
      <div className="pr-body">
        <span className="pr-place">
          {taskPlace(task)} · {text.points(task.points)}
        </span>
        <p className="pr-statement">
          <RichText parts={task.statement} />
        </p>
        {answer.kind === "choice" && (
          <ol className="pr-options">
            {answer.options.map((option) => (
              <li key={option}>{option}</li>
            ))}
          </ol>
        )}
        {answer.kind === "match" && (
          <div className="pr-match">
            <ol type="A">
              {answer.left.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <ol>
              {answer.right.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        )}
        {withAnswers ? (
          answer.kind === "extended" ? (
            <p className="pr-criteria">
              <b>{text.criteria}:</b> {answer.criteria}
            </p>
          ) : (
            <p className="pr-key">
              {text.answer}: {answerText(answer)}
            </p>
          )
        ) : answer.kind === "extended" ? (
          <div className="pr-lines" aria-label={text.solution}>
            {Array.from({ length: LINES }, (_, line) => (
              <i key={line} />
            ))}
          </div>
        ) : (
          <div className="pr-answer">
            {text.answer}: <Cells />
          </div>
        )}
      </div>
    </li>
  );
}

function Sheet({ job }: { job: PrintJob }) {
  const points = job.items.reduce((sum, task) => sum + task.points, 0);
  const blank = job.variant === "blank";
  return (
    <article>
      <header className="pr-head">
        <div className="pr-brand">
          <b>{text.brand}</b>
          {job.due && <span>{text.due(formatShortDate(job.due))}</span>}
        </div>
        <h1 className="pr-title">{blank ? `${text.blankTitle}: ${job.title}` : job.title}</h1>
        <p className="pr-meta">{text.meta(tasksText.count(job.items.length), tasksText.points(points), tasksText.minutes(estimateMinutes(job.items)))}</p>
        {job.variant !== "answers" && (
          <div className="pr-fields">
            <div className="pr-field">
              {text.name}: <span>{job.studentName ?? ""}</span>
            </div>
            <div className="pr-field">
              {text.date}: <span />
            </div>
            <div className="pr-field">
              {text.variant}: <span>1</span>
            </div>
          </div>
        )}
      </header>
      {job.variant === "student" && <p className="pr-instruction">{text.instruction}</p>}
      {blank ? (
        <div className="pr-blank">
          {job.items.map((task, index) => (
            <div key={task.id} className="pr-blank-row">
              <b>{index + 1}</b>
              {task.answer.kind === "extended" ? <span>{text.separateSheet}</span> : <Cells />}
            </div>
          ))}
        </div>
      ) : (
        <ol className="pr-tasks">
          {job.items.map((task, index) => (
            <TaskBlock key={task.id} task={task} index={index + 1} withAnswers={job.variant === "answers"} />
          ))}
        </ol>
      )}
      <p className="pr-foot">{text.footer}</p>
    </article>
  );
}

/** Хост печати: показывает лист только при печати, после диалога печати убирает его. */
export function PrintHost() {
  const job = usePrintJob();

  useEffect(() => {
    if (!job) return;
    const done = () => clearPrint();
    window.addEventListener("afterprint", done);
    // Лист уже в DOM — открываем печать на следующем кадре, когда шрифты и вёрстка готовы.
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
    };
  }, [job]);

  if (!job) return null;
  return createPortal(
    <div className="print-root">
      <Sheet job={job} />
    </div>,
    document.body,
  );
}
