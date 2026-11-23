import { ArrowDown, ArrowUp, ClipboardList, FileDown, Library, RefreshCw, Trash2, X, Zap } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/kit/dialog";
import styles from "./tasks.module.css";
import { navigate } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import { replacementFor } from "../../tasks/assistant";
import { clearDraft, draftSummary, moveInDraft, removeFromDraft, replaceInDraft, setDraftTitle, useDraft } from "../../tasks/draft";
import { tasksText as text } from "../../tasks/tasks.ru";
import { Button } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { ToolButton } from "../../ui/TaskCard";
import { Input } from "@/shared/ui/kit/input";
import { TaskView } from "./TaskView";

export type SaveKind = "homework" | "test";

type Props = { onSave: (kind: SaveKind) => void; onPdf: () => void };

/** Черновик справа от чата: порядок, замена, удаление; из него — задание или тест (TASKS-1, TASKS-2). */
export function DraftPanel({ onSave, onPdf }: Props) {
  const { notify } = useNotifier();
  const [clearing, setClearing] = useState(false);
  const draft = useDraft();
  const summary = draftSummary(draft.items);

  const replace = (id: string) => {
    const target = draft.items.find((task) => task.id === id);
    const swap = target ? replacementFor(target, draft.items, Date.now()) : undefined;
    if (!swap) {
      notify(text.draft.noReplace);
      return;
    }
    replaceInDraft(id, swap);
    notify(text.draft.replaced);
  };

  return (
    <section className={styles.draft} aria-label={text.draft.title}>
      <header className={styles.draftHeader}>
        <div className="flex items-center gap-2">
          <span className="grid size-8 flex-none place-items-center rounded-lg bg-highlight text-highlight-foreground" aria-hidden="true">
            <ClipboardList size={16} />
          </span>
          <div className={styles.draftTitle}><h2>{text.draft.title}</h2><label><span>{text.draft.topic}:</span><Input
            value={draft.title}
            maxLength={120}
            placeholder={text.draft.titlePlaceholder}
            aria-label={text.draft.titleLabel}
            onChange={(event) => setDraftTitle(event.target.value)}
            className={styles.topicInput}
          /></label></div>
        </div>
        <p className="m-0 text-sm font-semibold text-muted-foreground tabular-nums">
          {text.draft.summary(text.count(summary.count), text.points(summary.points), text.minutes(summary.minutes))}
          {summary.count > 0 && ` · ${text.draft.auto(summary.auto, summary.count)}`}
        </p>
      </header>

      <div className={styles.draftList}>
        {draft.items.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="m-0 max-w-xs text-sm font-semibold text-muted-foreground">{text.draft.empty}</p>
            <Button size="sm" icon={Library} onClick={() => navigate(teacherRoutes.tasksBank)}>
              {text.draft.toBank}
            </Button>
          </div>
        ) : (
          <ol className="m-0 grid list-none gap-3 p-0" aria-label={text.draft.listLabel}>
            {draft.items.map((task, index) => (
              <li key={task.id}>
                <TaskView
                  task={task}
                  index={index + 1}
                  compact
                  tools={
                    <>
                      <ToolButton label={`${text.task.up}: ${text.task.position(index + 1)}`} onClick={() => moveInDraft(task.id, -1)}>
                        <ArrowUp size={13} aria-hidden="true" />
                      </ToolButton>
                      <ToolButton label={`${text.task.down}: ${text.task.position(index + 1)}`} onClick={() => moveInDraft(task.id, 1)}>
                        <ArrowDown size={13} aria-hidden="true" />
                      </ToolButton>
                      <ToolButton icon={RefreshCw} onClick={() => replace(task.id)}>
                        {text.task.replace}
                      </ToolButton>
                      <ToolButton label={`${text.task.remove}: ${text.task.position(index + 1)}`} onClick={() => removeFromDraft(task.id)}>
                        <X size={13} aria-hidden="true" />
                      </ToolButton>
                    </>
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      <footer className={styles.draftActions}>
        <Button variant="primary" icon={ClipboardList} disabled={summary.count === 0} onClick={() => onSave("homework")}>
          {text.draft.saveTask}
        </Button>
        <Button variant="lime" icon={Zap} disabled={summary.count === 0} onClick={() => onSave("test")}>
          {text.draft.saveTest}
        </Button>
        <Button icon={FileDown} disabled={summary.count === 0} onClick={onPdf}>
          {text.draft.pdf}
        </Button>
        <Button
          icon={Trash2}
          disabled={summary.count === 0}
          onClick={() => {
            setClearing(true);
          }}
        >
          {text.draft.clear}
        </Button>
      </footer>
      <Dialog open={clearing} onOpenChange={setClearing}>
        <DialogContent><DialogTitle>{text.draft.clear}</DialogTitle><DialogDescription>{text.draft.clearDescription}</DialogDescription><div className="flex flex-wrap gap-2"><Button onClick={() => setClearing(false)}>{text.draft.cancelClear}</Button><Button variant="primary" onClick={() => { clearDraft(); setClearing(false); notify(text.draft.cleared); }}>{text.draft.clear}</Button></div></DialogContent>
      </Dialog>
    </section>
  );
}
