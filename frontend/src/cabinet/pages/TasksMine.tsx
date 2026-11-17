import { cabinet } from "../content/cabinet.ru";
import { getTaskLab } from "../data";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DataTable } from "../ui/DataTable";
import { useNotifier } from "../ui/Notifications";
import ui from "../ui/ui.module.css";

const text = cabinet.teacher.tasks.mine;

export function TasksMine() {
  const { notifySoon } = useNotifier();

  return (
    <Card scroll>
      <DataTable columns={text.columns} minWidth={620} label={cabinet.teacher.tasks.tabs[2]?.label}>
        {getTaskLab().mine.map((task) => (
          <tr key={task.title}>
            <td>
              <b>{task.title}</b>
            </td>
            <td className={ui.num}>{task.cards}</td>
            <td>{task.assigned}</td>
            <td className={ui.num}>{task.average}</td>
            <td>
              <Button size="sm" onClick={() => notifySoon(text.assign)}>
                {text.assign}
              </Button>
            </td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
