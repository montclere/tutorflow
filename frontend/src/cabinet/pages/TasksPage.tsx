import { navigate } from "../../app/router";
import { teacherRoutes } from "../../config/routes";
import { cabinet } from "../content/cabinet.ru";
import { Button } from "../ui/Button";
import { useNotifier } from "../ui/Notifications";
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
  const { notifySoon } = useNotifier();

  return (
    <>
      <PageHead
        title={text.title}
        subtitle={text.subtitle}
        actions={
          <>
            <Button onClick={() => notifySoon(text.manual)}>{text.manual}</Button>
            <Button variant="primary" onClick={() => navigate(teacherRoutes.tasksCreate)}>
              {text.withAi}
            </Button>
          </>
        }
      />
      <Tabs label={text.tabsLabel} items={tabItems} selectedId={tab} />
      {tab === "create" && <TasksCreate />}
      {tab === "bank" && <TasksBank />}
      {tab === "mine" && <TasksMine />}
    </>
  );
}
