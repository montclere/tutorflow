import styles from "./tasks/tasks.module.css";
import { useRef } from "react";
import { tasksText } from "../tasks/tasks.ru";
import { useNotifier } from "../ui/Notifications";
import { AssistantChat } from "./tasks/AssistantChat";
import { DraftPanel, type SaveKind } from "./tasks/DraftPanel";

/** Сборка: слева ИИ-помощник, справа черновик; на узком экране черновик — под чатом (TASKS-1, TASKS-3). */
export function TasksCreate({ onSave, onPdf }: { onSave?: (kind: SaveKind) => void; onPdf?: () => void }) {
  const { notifySoon } = useNotifier();
  const draftRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.create}>
      <AssistantChat onShowDraft={() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      <div ref={draftRef} className={styles.draftWrap}>
        <DraftPanel onSave={onSave ?? ((kind) => notifySoon(kind === "test" ? tasksText.draft.saveTest : tasksText.draft.saveTask))} onPdf={onPdf ?? (() => notifySoon(tasksText.draft.pdf))} />
      </div>
    </div>
  );
}
