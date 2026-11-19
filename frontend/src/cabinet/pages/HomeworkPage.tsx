import { Check, X } from "lucide-react";
import { useState } from "react";
import { navigate } from "../../app/router";
import { studentRoutes } from "../../config/routes";
import { cabinet } from "../content/cabinet.ru";
import { getHomework } from "../data";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ICON_SIZE } from "../ui/Icon";
import { ListRow } from "../ui/ListRow";
import { useNotifier } from "../ui/Notifications";
import { PageHead } from "../ui/PageHead";
import { Pill } from "../ui/Pill";
import { RowList } from "../ui/RowList";
import { Tabs } from "../ui/Tabs";
import ui from "../ui/ui.module.css";
import { PrintDialog, type PrintSource } from "./tasks/PrintDialog";
import { StudentAssignments } from "./tasks/StudentAssignments";

const text = cabinet.student.tasks;

type HomeworkTab = (typeof text.tabs)[number]["id"];

export function HomeworkPage() {
  const { notifySoon } = useNotifier();
  const data = getHomework();
  const [tab, setTab] = useState<HomeworkTab>("todo");
  const [printing, setPrinting] = useState<PrintSource | null>(null);

  return (
    <>
      <PageHead title={text.title} subtitle={text.subtitle} />
      <StudentAssignments onPrint={(work, assignment) => setPrinting({ title: work.title, items: work.items, due: assignment.due, variants: ["student", "blank"] })} />
      <PrintDialog source={printing} onClose={() => setPrinting(null)} />
      <Tabs label={text.tabsLabel} items={[...text.tabs]} selectedId={tab} onSelect={(id) => setTab(id as HomeworkTab)} />

      {tab === "todo" && (
        <div className={`${ui.grid} ${ui.g2}`}>
          {data.todo.map((task) => (
            <Card key={task.title} title={task.title} subtitle={task.subtitle} action={<Pill tone={task.tone}>{task.status}</Pill>}>
              <p className={ui.muted}>
                <b>{task.deadline}</b>
              </p>
              <div className={ui.headActions}>
                <Button variant="primary" onClick={() => navigate(studentRoutes.trainer)}>
                  {cabinet.common.solve}
                </Button>
                <Button onClick={() => notifySoon(text.pdf)}>{text.pdf}</Button>
                <Button onClick={() => notifySoon(text.submitPhoto)}>{text.submitPhoto}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "wait" && (
        <Card>
          <ListRow title={data.waiting.title} note={data.waiting.note}>
            <Pill tone="blue">{data.waiting.status}</Pill>
          </ListRow>
        </Card>
      )}

      {tab === "done" && (
        <div className={`${ui.grid} ${ui.g2}`}>
          <Card title={data.done.title} subtitle={data.done.checkedOn} action={<Pill tone="ok">{data.done.score}</Pill>}>
            <RowList>
              {data.done.results.map((result) => (
                <ListRow
                  key={result.title}
                  lead={<Pill tone={result.ok ? "ok" : "bad"}>{result.ok ? <Check size={ICON_SIZE - 6} aria-label="Верно" /> : <X size={ICON_SIZE - 6} aria-label="Неверно" />}</Pill>}
                  title={result.title}
                  note={result.note}
                />
              ))}
            </RowList>
            <div className={ui.headActions}>
              <Button variant="lime" onClick={() => notifySoon(text.mistakes)}>
                {text.mistakes}
              </Button>
              <Button onClick={() => notifySoon(text.explanations)}>{text.explanations}</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
