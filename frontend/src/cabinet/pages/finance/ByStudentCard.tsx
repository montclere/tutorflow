import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { FinanceOperation } from "../../mocks/types";
import { formatRubles } from "../../model/format";
import { incomeByStudent } from "../../model/finance";
import { Avatar } from "../../ui/Avatar";
import { Card } from "../../ui/Card";

const text = cabinet.teacher.finance.byStudent;
const MAX_ROWS = 6;

/** Кто сколько заплатил за месяц — горизонтальные полоски, по убыванию (FINANCE-3). */
export function ByStudentCard({ operations, monthName }: { operations: FinanceOperation[]; monthName: string }) {
  const rows = incomeByStudent(operations).slice(0, MAX_ROWS);
  const max = rows[0]?.amount ?? 1;
  return (
    <Card title={text.title} subtitle={text.hint(monthName)}>
      {rows.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm font-semibold text-muted-foreground">{text.empty}</p>
      ) : (
        <ul className="m-0 grid list-none gap-3.5 p-0">
          {rows.map((row) => {
            const student = getStudent(row.studentId);
            return (
              <li key={row.studentId} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <Avatar initials={student.initials} color={student.color} />
                <div className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <b className="truncate text-sm font-extrabold">{student.name}</b>
                    <span className="text-sm font-extrabold whitespace-nowrap tabular-nums">{formatRubles(row.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(row.amount / max) * 100}%` }} />
                    </span>
                    <span className="w-16 text-right text-xs font-semibold whitespace-nowrap text-muted-foreground">{text.payments(row.payments)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
