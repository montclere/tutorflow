import { useRef, useState } from "react";
import { PrintDialog, type PrintSource } from "./tasks/PrintDialog";
import { StudentAssignments } from "./tasks/StudentAssignments";

/** «Задания» ученика: выданное репетитором, решение — в плеере на весь экран (TASKS-8, STUDENT-4). */
export function HomeworkPage() {
  const [printing, setPrinting] = useState<PrintSource | null>(null);
  const printTrigger = useRef<HTMLElement | null>(null);
  const closePrint = () => {
    setPrinting(null);
    requestAnimationFrame(() => printTrigger.current?.focus());
  };
  return (
    <>
      <StudentAssignments onPrint={(work, assignment) => {
        printTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setPrinting({ title: work.title, items: work.items, due: assignment.due, variants: ["student", "blank"] });
      }} />
      <PrintDialog source={printing} onClose={closePrint} />
    </>
  );
}
