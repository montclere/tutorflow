import { cabinet } from "../content/cabinet.ru";
import { getFinance, getStudent } from "../data";
import { formatSigned } from "../model/format";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DataTable } from "../ui/DataTable";
import { useNotifier } from "../ui/Notifications";
import { PageHead } from "../ui/PageHead";
import { StatGrid } from "../ui/Stat";
import ui from "../ui/ui.module.css";

const text = cabinet.teacher.finance;

export function FinancePage() {
  const { notifySoon } = useNotifier();
  const data = getFinance();

  return (
    <>
      <PageHead
        title={text.title}
        subtitle={data.month}
        actions={
          <>
            <Button onClick={() => notifySoon(text.export)}>{text.export}</Button>
            <Button variant="primary" onClick={() => notifySoon(text.addPayment)}>
              {text.addPayment}
            </Button>
          </>
        }
      />
      <StatGrid stats={data.stats} columns={4} />
      <div className={ui.gap}>
        <Card title={text.operations} scroll>
          <DataTable columns={text.columns} minWidth={560} label={text.operations}>
            {data.operations.map((operation) => (
              <tr key={`${operation.date}-${operation.studentId}-${operation.title}`}>
                <td>{operation.date}</td>
                <td>{getStudent(operation.studentId).name}</td>
                <td>{operation.title}</td>
                <td className={`${ui.num} ${operation.amountKopecks < 0 ? ui.negative : ui.positive}`}>{formatSigned(operation.amountKopecks)}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </>
  );
}
