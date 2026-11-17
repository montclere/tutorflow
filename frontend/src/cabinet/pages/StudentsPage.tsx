import { cabinet } from "../content/cabinet.ru";
import { getStudents } from "../data";
import { formatSigned } from "../model/format";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DataTable } from "../ui/DataTable";
import { useNotifier } from "../ui/Notifications";
import { PageHead } from "../ui/PageHead";
import { ProgressBar } from "../ui/ProgressBar";
import ui from "../ui/ui.module.css";
import styles from "./pages.module.css";

const text = cabinet.teacher.students;

function balanceClass(kopecks: number) {
  if (kopecks < 0) return ui.negative;
  return kopecks > 0 ? ui.positive : ui.muted;
}

export function StudentsPage() {
  const { notifySoon } = useNotifier();
  const students = getStudents();

  return (
    <>
      <PageHead
        title={text.title}
        subtitle={text.subtitle}
        actions={
          <>
            <Button onClick={() => notifySoon(text.import)}>{text.import}</Button>
            <Button variant="primary" onClick={() => notifySoon(text.invite)}>
              {text.invite}
            </Button>
          </>
        }
      />
      <Card scroll>
        <DataTable columns={text.columns} minWidth={640} label={text.title}>
          {students.map((student) => (
            <tr key={student.id}>
              <td>
                <div className={ui.cellPerson}>
                  <Avatar initials={student.initials} tone={student.tone} />
                  <b>{student.name}</b>
                </div>
              </td>
              <td>{student.subject}</td>
              <td className={ui.num}>{student.lessons}</td>
              <td className={`${ui.num} ${balanceClass(student.balanceKopecks)}`}>{formatSigned(student.balanceKopecks)}</td>
              <td className={styles.progressCell}>
                <ProgressBar percent={student.progress} />
                <span className={styles.progressNote}>{text.progress(student.progress)}</span>
              </td>
              <td>
                <Button size="sm" onClick={() => notifySoon(cabinet.common.open)}>
                  {cabinet.common.open}
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
