import { Checks as PhChecks, CursorClick as PhCursorClick } from "@phosphor-icons/react";
import { useState } from "react";
import { cabinet } from "../content/cabinet.ru";
import { useLibrary, type WorkKind } from "../tasks/library";
import { EmptyState } from "../ui/EmptyState";
import { StudyHeading } from "./tasks/StudyHeading";
import styles from "./review/review.module.css";
import { ReviewDetail } from "./review/ReviewDetail";
import { ReviewPanel } from "./review/ReviewPanel";

const text = cabinet.teacher.review;

/** Проверка: слева работы (задания и тесты) с учениками, справа — окно проверки выбранной работы (REVIEW-*). */
export function ReviewPage() {
  const { works, assignments } = useLibrary();
  const [kind, setKind] = useState<WorkKind>("homework");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const firstWaiting = assignments.find((assignment) => assignment.status === "wait" && works.find((work) => work.id === assignment.workId)?.kind === kind);
  const selected = assignments.find((assignment) => assignment.id === selectedId) ?? firstWaiting ?? null;
  const work = selected ? works.find((item) => item.id === selected.workId) : undefined;

  return (
    <div className={styles.page}>
      <StudyHeading title={text.title} />
      <div className={styles.columns}>
        <ReviewPanel
          kind={kind}
          onKind={(next) => {
            setKind(next);
            setSelectedId(null);
          }}
          works={works}
          assignments={assignments}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
        />
        {selected && work ? (
          <ReviewDetail key={selected.id} assignment={selected} work={work} />
        ) : (
          <EmptyState icon={firstWaiting === undefined && kind === "homework" ? PhChecks : PhCursorClick} title={firstWaiting === undefined && kind === "homework" ? text.allDone : text.emptyDetail} />
        )}
      </div>
    </div>
  );
}
