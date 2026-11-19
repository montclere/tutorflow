import { useState } from "react";
import { cabinet } from "../content/cabinet.ru";
import { PageHead } from "../ui/PageHead";
import { PrintDialog, type PrintSource } from "./tasks/PrintDialog";
import { StudentAssignments } from "./tasks/StudentAssignments";

const text = cabinet.student.tasks;

/** «Задания» ученика: выданное репетитором, решение — в плеере на весь экран (TASKS-8, STUDENT-4). */
export function HomeworkPage() {
  const [printing, setPrinting] = useState<PrintSource | null>(null);
  return (
    <>
      <PageHead title={text.title} subtitle={text.subtitle} />
      <StudentAssignments onPrint={(work, assignment) => setPrinting({ title: work.title, items: work.items, due: assignment.due, variants: ["student", "blank"] })} />
      <PrintDialog source={printing} onClose={() => setPrinting(null)} />
    </>
  );
}
