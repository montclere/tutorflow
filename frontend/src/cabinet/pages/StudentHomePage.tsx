import { Star, Zap } from "lucide-react";
import { navigate } from "../../app/router";
import { studentRoutes } from "../../config/routes";
import { cabinet } from "../content/cabinet.ru";
import { getStudentHome } from "../data";
import { Button, LinkButton } from "../ui/Button";
import { Card } from "../ui/Card";
import { ICON_SIZE } from "../ui/Icon";
import { ListRow } from "../ui/ListRow";
import { PageHead } from "../ui/PageHead";
import { Pill } from "../ui/Pill";
import { ProgressBar } from "../ui/ProgressBar";
import { RowList } from "../ui/RowList";
import { StatGrid } from "../ui/Stat";
import ui from "../ui/ui.module.css";
import { StudentMaterials } from "./StudentMaterials";

const text = cabinet.student.home;

export function StudentHomePage() {
  const data = getStudentHome();

  return (
    <>
      <PageHead
        title={data.greeting}
        subtitle={data.subtitle}
        actions={
          <Button variant="lime" icon={Zap} onClick={() => navigate(studentRoutes.trainer)}>
            {text.trainer}
          </Button>
        }
      />
      <StatGrid stats={data.stats} columns={4} />

      <div className={`${ui.grid} ${ui.g21} ${ui.gap}`}>
        <Card
          title={text.homeworkTitle}
          subtitle={text.homeworkSub}
          action={<LinkButton onClick={() => navigate(studentRoutes.tasks)}>{cabinet.common.all}</LinkButton>}
        >
          <RowList>
            {data.homework.map((task) => (
              <ListRow key={task.title} title={task.title} note={task.note}>
                <Pill tone={task.tone}>{task.status}</Pill>
              </ListRow>
            ))}
          </RowList>
        </Card>

        <Card title={text.weakTitle} subtitle={text.weakSub}>
          <RowList>
            {data.weak.map((item) => (
            <ListRow
              key={item.number}
              lead={<Pill tone="bad">{`№${item.number}`}</Pill>}
              title={item.topic}
              note={<ProgressBar percent={item.percent} tone="danger" />}
            >
              <Button size="sm" onClick={() => navigate(studentRoutes.trainer)}>
                {cabinet.common.solve}
              </Button>
            </ListRow>
            ))}
          </RowList>
        </Card>
      </div>

      <div className={ui.gap}>
        <StudentMaterials />
      </div>

      <div className={ui.gap}>
        <Card title={text.feedbackTitle}>
          <div className={`${ui.alert} ${ui.alertLime}`}>
            <div className={ui.alertIcon} aria-hidden="true">
              <Star size={ICON_SIZE} aria-hidden="true" />
            </div>
            <div>
              <b>{data.feedback.title}</b>
              <span>{data.feedback.text}</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
