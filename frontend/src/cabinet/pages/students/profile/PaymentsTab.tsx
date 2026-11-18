import { Plus } from "lucide-react";
import { cabinet } from "../../../content/cabinet.ru";
import { getStudentDetails } from "../../../data";
import type { PaymentMove, Student } from "../../../mocks/types";
import { formatMonthTitle, formatShortDate } from "../../../model/dates";
import { formatRubles, formatSigned } from "../../../model/format";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";
import { formatBalance } from "../StudentsTable";
import { DateCell, Empty, Kpi, Panel } from "./parts";

const text = cabinet.teacher.students.profile.payments;

function byMonth(moves: PaymentMove[]): { month: string; moves: PaymentMove[] }[] {
  const groups: { month: string; moves: PaymentMove[] }[] = [];
  for (const move of moves) {
    const month = move.date.slice(0, 7);
    const group = groups.at(-1);
    if (group?.month === month) group.moves.push(move);
    else groups.push({ month, moves: [move] });
  }
  return groups;
}

export function PaymentsTab({ student, onAdd }: { student: Student; onAdd: () => void }) {
  const { payments } = getStudentDetails(student.id);
  const paid = payments.filter((move) => move.amount > 0).reduce((sum, move) => sum + move.amount, 0);
  const spent = payments.filter((move) => move.amount < 0).reduce((sum, move) => sum + move.amount, 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-3 gap-3 max-[520px]:grid-cols-1">
        <Kpi label={text.balance} value={formatBalance(student.balance)} tone={student.balance < 0 ? "bad" : student.balance > 0 ? "good" : undefined} />
        <Kpi label={text.paid} value={formatRubles(paid)} />
        <Kpi label={text.lessons} value={formatRubles(spent)} />
      </div>
      <Panel
        title={cabinet.teacher.students.profile.tabs[4].label}
        action={
          <Button variant="primary" size="sm" icon={Plus} onClick={onAdd}>
            {text.add}
          </Button>
        }
      >
        {payments.length === 0 ? (
          <Empty>{text.empty}</Empty>
        ) : (
          <div className="grid gap-4">
            {byMonth(payments).map((group) => (
              <section key={group.month} className="grid gap-1">
                <h4 className="m-0 text-xs font-bold tracking-wide text-muted-foreground uppercase">{formatMonthTitle(`${group.month}-01`)}</h4>
                <ul className="m-0 list-none divide-y divide-border p-0">
                  {group.moves.map((move) => (
                    <li key={`${move.date}-${move.title}-${move.amount}`} className="flex items-center gap-3 py-3">
                      <DateCell>{formatShortDate(move.date)}</DateCell>
                      <span className="min-w-0 flex-1 text-base font-bold">{move.title}</span>
                      <b className={cx("font-[family-name:var(--font-display)] text-base font-extrabold whitespace-nowrap tabular-nums", move.amount < 0 ? "text-destructive" : "text-success")}>
                        {formatSigned(move.amount)}
                      </b>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
