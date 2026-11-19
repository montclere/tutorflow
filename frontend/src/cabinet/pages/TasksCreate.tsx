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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1181px]:h-[max(600px,calc(100dvh-236px))] min-[1181px]:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <AssistantChat onShowDraft={() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      <div ref={draftRef} className="flex min-h-0 flex-col max-[1180px]:max-h-[80dvh]">
        <DraftPanel onSave={onSave ?? ((kind) => notifySoon(kind === "test" ? tasksText.draft.saveTest : tasksText.draft.saveTask))} onPdf={onPdf ?? (() => notifySoon(tasksText.draft.pdf))} />
      </div>
    </div>
  );
}
