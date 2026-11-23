import { ClipboardList } from "lucide-react";
import { navigate } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import { draftSummary, useDraft } from "../../tasks/draft";
import { tasksText as text } from "../../tasks/tasks.ru";
import { Button } from "../../ui/Button";

/** Плашка черновика на вкладках «Банк» и «Мои задания»: видно, что набрано, и можно перейти к сборке. */
export function DraftDock() {
  const draft = useDraft();
  const summary = draftSummary(draft.items);
  if (summary.count === 0) return null;
  return (
    <div className="sticky bottom-4 z-30 mt-4 flex justify-center">
      <div className="flex items-center gap-3 rounded-full border bg-[var(--color-ink)] py-1.5 pr-1.5 pl-4 text-sm font-bold text-white shadow-lg">
        <ClipboardList size={16} aria-hidden="true" />
        <span className="tabular-nums">
          {text.dock.label} · {text.count(summary.count)} · {text.minutes(summary.minutes)}
        </span>
        <Button size="sm" variant="lime" className="rounded-full" onClick={() => navigate(teacherRoutes.tasksCreate)}>
          {text.dock.open}
        </Button>
      </div>
    </div>
  );
}
