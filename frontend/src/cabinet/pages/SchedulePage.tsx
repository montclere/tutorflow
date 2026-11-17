import { cabinet } from "../content/cabinet.ru";
import { getSchedule, getStudent } from "../data";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DataTable } from "../ui/DataTable";
import { useNotifier } from "../ui/Notifications";
import { PageHead } from "../ui/PageHead";
import ui from "../ui/ui.module.css";
import styles from "./pages.module.css";

const text = cabinet.teacher.schedule;

export function SchedulePage() {
  const { notifySoon } = useNotifier();
  const data = getSchedule();

  return (
    <>
      <PageHead
        title={text.title}
        subtitle={data.range}
        actions={
          <>
            <Button aria-label={text.prevLabel} onClick={() => notifySoon(text.prevLabel)}>
              {text.prev}
            </Button>
            <Button aria-label={text.nextLabel} onClick={() => notifySoon(text.nextLabel)}>
              {text.next}
            </Button>
            <Button variant="primary" onClick={() => notifySoon(text.addLesson)}>
              {text.addLesson}
            </Button>
          </>
        }
      />
      <Card scroll>
        <DataTable columns={["", ...data.days]} minWidth={640} label={text.tableLabel}>
          {data.hours.map((hour, hourIndex) => (
            <tr key={hour}>
              <td className={`${ui.time} ${ui.muted}`}>{hour}</td>
              {data.days.map((day, dayIndex) => {
                const event = data.events.find((item) => item.day === dayIndex && item.hour === hourIndex);
                const student = event ? getStudent(event.studentId) : null;
                return (
                  <td key={day} className={styles.slot}>
                    {event && student && (
                      <div className={`${styles.event} ${styles[`event-${event.tone}`]}`}>
                        <b>{student.name.split(" ")[0]}</b>
                        {student.subject.split(" · ")[0]}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
