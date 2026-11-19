import { cabinet } from "../content/cabinet.ru";
import { PageHead } from "../ui/PageHead";
import { Tabs } from "../ui/Tabs";
import { TasksBank } from "./TasksBank";
import { TasksCreate } from "./TasksCreate";
import { TasksMine } from "./TasksMine";

const text = cabinet.teacher.tasks;

export type TasksTab = "create" | "bank" | "mine";

const tabIds: TasksTab[] = ["create", "bank", "mine"];
const tabItems = text.tabs.map((tab, index) => ({ id: tabIds[index] ?? "create", label: tab.label, href: tab.path }));

export function TasksPage({ tab }: { tab: TasksTab }) {
  return (
    <>
      <PageHead title={text.title} />
      <div className="mb-4">
        <Tabs label={text.tabsLabel} items={tabItems} selectedId={tab} />
      </div>
      {tab === "create" && <TasksCreate />}
      {tab === "bank" && <TasksBank />}
      {tab === "mine" && <TasksMine />}
    </>
  );
}
