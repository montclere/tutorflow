import { useState } from "react";
import { navigate } from "../../app/router";
import { studentRoutes } from "../../config/routes";
import { cabinet } from "../content/cabinet.ru";
import { getHomework } from "../data";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ListRow } from "../ui/ListRow";
import { useNotifier } from "../ui/Notifications";
import { PageHead } from "../ui/PageHead";
import { Pill } from "../ui/Pill";
import { Tabs } from "../ui/Tabs";
import ui from "../ui/ui.module.css";

const text = cabinet.student.tasks;

type HomeworkTab = (typeof text.tabs)[number]["id"];

export function HomeworkPage() {
  const { notifySoon } = useNotifier();
  const data = getHomework();
  const [tab, setTab] = useState<HomeworkTab>("todo");

  return (
    <>
      <PageHead title={text.title} subtitle={text.subtitle} />
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
            {data.done.results.map((result) => (
              <ListRow key={result.title} lead={<Pill tone={result.ok ? "ok" : "bad"}>{result.ok ? "✓" : "✕"}</Pill>} title={result.title} note={result.note} />
            ))}
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
