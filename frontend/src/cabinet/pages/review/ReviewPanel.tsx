import { ClipboardList, Zap } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import { attemptScore, type Assignment, type Work, type WorkKind } from "../../tasks/library";
import { Avatar } from "../../ui/Avatar";
import { cx } from "../../ui/cx";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";

const text = cabinet.teacher.review;

type Props = {
  kind: WorkKind;
  onKind: (kind: WorkKind) => void;
  works: Work[];
  assignments: Assignment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const statusDot = { todo: "bg-muted-foreground/40", wait: "bg-primary", done: "bg-success" } as const;

/** Слева — работы по заданиям и тестам, внутри — ученики со статусом (REVIEW-1). */
export function ReviewPanel({ kind, onKind, works, assignments, selectedId, onSelect }: Props) {
  const waitingOf = (target: WorkKind) => assignments.filter((assignment) => assignment.status === "wait" && works.find((work) => work.id === assignment.workId)?.kind === target).length;
  const groups = works
    .filter((work) => work.kind === kind)
    .map((work) => ({ work, items: assignments.filter((assignment) => assignment.workId === work.id && (kind === "test" ? assignment.attempts.length > 0 : assignment.attempts.length > 0 || assignment.status === "wait")) }))
    .filter((group) => group.items.length > 0)
    // Работы с непроверенным — сверху.
    .sort((a, b) => Number(b.items.some((item) => item.status === "wait")) - Number(a.items.some((item) => item.status === "wait")));

  return (
    <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 glass rounded-2xl p-3" aria-label={text.panelLabel}>
      <ToggleGroup type="single" spacing={1} value={kind} aria-label={text.panelLabel} className="grid w-full grid-cols-2 gap-1 rounded-lg bg-secondary p-1" onValueChange={(value) => value && onKind(value as WorkKind)}>
        {(["homework", "test"] as const).map((id) => (
          <ToggleGroupItem key={id} value={id} className="min-w-0 truncate data-[state=on]:bg-card data-[state=on]:shadow-sm">
            {text.tabLabel(text.tabs[id], waitingOf(id))}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {groups.length === 0 ? (
        <p className="m-0 px-2 py-6 text-center text-sm font-semibold text-muted-foreground">{text.emptyPanel[kind]}</p>
      ) : (
        groups.map(({ work, items }) => {
          const waiting = items.filter((item) => item.status === "wait").length;
          return (
            <section key={work.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
              <header className="flex items-center gap-2 px-2 pt-2">
                {work.kind === "test" ? <Zap size={14} className="text-muted-foreground" aria-hidden="true" /> : <ClipboardList size={14} className="text-muted-foreground" aria-hidden="true" />}
                <b className="min-w-0 flex-1 truncate text-sm font-extrabold">{work.title}</b>
                {waiting > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-extrabold text-primary-foreground tabular-nums">{text.waiting(waiting)}</span>}
              </header>
              <ul className="m-0 grid list-none gap-0.5 p-0">
                {items.map((assignment) => {
                  const student = getStudent(assignment.studentId);
                  const last = assignment.attempts.at(-1);
                  const score = last ? attemptScore(work.items, last.results) : null;
                  return (
                    <li key={assignment.id}>
                      <button
                        type="button"
                        aria-pressed={assignment.id === selectedId}
                        onClick={() => onSelect(assignment.id)}
                        className={cx(
                          "flex w-full appearance-none items-center gap-2.5 rounded-xl border-0 px-2 py-2 text-left text-foreground [font-family:inherit] transition-colors",
                          assignment.id === selectedId ? "bg-accent" : "bg-transparent hover:bg-secondary",
                        )}
                      >
                        <Avatar initials={student.initials} color={student.color} />
                        <span className="grid min-w-0 flex-1">
                          <b className="truncate text-sm font-extrabold">{student.name}</b>
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <span className={cx("size-1.5 rounded-full", statusDot[assignment.status])} aria-hidden="true" />
                            {text.status[assignment.status]}
                          </span>
                        </span>
                        {score?.percent !== null && score && assignment.status === "done" && <b className="text-sm font-extrabold tabular-nums">{score.percent}%</b>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </aside>
  );
}
