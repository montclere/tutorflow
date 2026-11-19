import { useState } from "react";
import { cabinet } from "../content/cabinet.ru";
import type { Work, WorkKind } from "../tasks/library";
import { getDraft } from "../tasks/draft";
import { PageHead } from "../ui/PageHead";
import { Tabs } from "../ui/Tabs";
import { AssignWorkDialog } from "./tasks/AssignWorkDialog";
import { PrintDialog, type PrintSource } from "./tasks/PrintDialog";
import { SaveWorkDialog } from "./tasks/SaveWorkDialog";
import { TasksBank } from "./TasksBank";
import { TasksCreate } from "./TasksCreate";
import { TasksMine } from "./TasksMine";

const text = cabinet.teacher.tasks;

export type TasksTab = "create" | "bank" | "mine";

const tabIds: TasksTab[] = ["create", "bank", "mine"];
const tabItems = text.tabs.map((tab, index) => ({ id: tabIds[index] ?? "create", label: tab.label, href: tab.path }));

export function TasksPage({ tab }: { tab: TasksTab }) {
  const [saving, setSaving] = useState<WorkKind | null>(null);
  const [assigning, setAssigning] = useState<Work | null>(null);
  const [printing, setPrinting] = useState<PrintSource | null>(null);
  const printDraft = () => {
    const draft = getDraft();
    setPrinting({ title: draft.title || cabinet.teacher.tasks.title, items: draft.items });
  };

  return (
    <>
      <PageHead title={text.title} />
      <div className="mb-4">
        <Tabs label={text.tabsLabel} items={tabItems} selectedId={tab} />
      </div>
      {tab === "create" && <TasksCreate onSave={setSaving} onPdf={printDraft} />}
      {tab === "bank" && <TasksBank />}
      {tab === "mine" && <TasksMine onAssign={setAssigning} onPdf={(work) => setPrinting({ title: work.title, items: work.items })} />}
      <SaveWorkDialog
        kind={saving}
        onClose={() => setSaving(null)}
        onSaved={(work, assign) => {
          setSaving(null);
          if (assign) setAssigning(work);
        }}
      />
      <AssignWorkDialog open={assigning !== null} work={assigning} onClose={() => setAssigning(null)} />
      <PrintDialog source={printing} onClose={() => setPrinting(null)} />
    </>
  );
}
