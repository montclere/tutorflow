import { cabinet } from "../content/cabinet.ru";
import { teacherRoutes } from "../../config/routes";
import { getStudent, getTeacherOverview } from "../data";
import { navigate } from "../../app/router";
import { Avatar } from "../ui/Avatar";
import { Button, LinkButton } from "../ui/Button";
import { Card } from "../ui/Card";
import { ListRow } from "../ui/ListRow";
import { useNotifier } from "../ui/Notifications";
import { PageHead } from "../ui/PageHead";
import { Pill } from "../ui/Pill";
import { StatGrid } from "../ui/Stat";
import ui from "../ui/ui.module.css";

const text = cabinet.teacher.overview;

export function OverviewPage() {
  const { notifySoon } = useNotifier();
  const data = getTeacherOverview();

  return (
    <>
      <PageHead
        title={data.greeting}
        subtitle={data.date}
        actions={
          <>
            <Button onClick={() => navigate(teacherRoutes.tasksCreate)}>{text.addTask}</Button>
            <Button variant="primary" onClick={() => notifySoon(text.addLesson)}>
              {text.addLesson}
            </Button>
          </>
        }
      />
      <StatGrid stats={data.stats} columns={4} />

      <div className={`${ui.grid} ${ui.g21} ${ui.gap}`}>
        <Card
          title={text.todayTitle}
          subtitle={text.todaySub}
          action={<LinkButton onClick={() => navigate(teacherRoutes.schedule)}>{cabinet.common.schedule}</LinkButton>}
        >
          {data.lessons.map((lesson) => {
            const student = getStudent(lesson.studentId);
            return (
              <ListRow
                key={lesson.time}
                lead={
                  <>
                    <span className={ui.time}>{lesson.time}</span>
                    <Avatar initials={student.initials} tone={student.tone} />
                  </>
                }
                title={student.name}
                note={lesson.subject}
              >
                <Pill tone={lesson.tone}>{lesson.status}</Pill>
                <Button size="sm" onClick={() => notifySoon(text.join)}>
                  {text.join}
                </Button>
              </ListRow>
            );
          })}
        </Card>

        <Card title={text.alertsTitle} subtitle={text.alertsSub} action={<Pill tone="warn">{data.alerts.length}</Pill>}>
          {data.alerts.map((alert) => (
            <div key={alert.title} className={ui.alert}>
              <div className={ui.alertIcon} aria-hidden="true">
                {alert.icon}
              </div>
              <div>
                <b>{alert.title}</b>
                <span>{alert.note}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div className={`${ui.grid} ${ui.g2} ${ui.gap}`}>
        <Card
          title={text.trainerTitle}
          subtitle={text.trainerSub}
          action={<LinkButton onClick={() => navigate(teacherRoutes.students)}>{cabinet.common.students}</LinkButton>}
        >
          {data.trainerWeek.map((item) => {
            const student = getStudent(item.studentId);
            return (
              <ListRow key={item.studentId} lead={<Avatar initials={student.initials} tone={student.tone} />} title={student.name} note={item.note}>
                <Pill tone="blue">{text.solved(item.solved)}</Pill>
              </ListRow>
            );
          })}
        </Card>

        <Card
          title={text.tasksTitle}
          subtitle={text.tasksSub}
          action={<LinkButton onClick={() => navigate(teacherRoutes.tasksCreate)}>{cabinet.common.allTasks}</LinkButton>}
        >
          {data.tasksWeek.map((task) => (
            <ListRow key={task.title} title={task.title} note={task.note}>
              <Pill tone={task.tone}>{task.status}</Pill>
            </ListRow>
          ))}
        </Card>
      </div>
    </>
  );
}
