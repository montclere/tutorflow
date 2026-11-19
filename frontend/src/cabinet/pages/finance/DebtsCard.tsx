import { Check } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { FinanceOverview } from "../../mocks/types";
import { formatRubles } from "../../model/format";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { ListRow } from "../../ui/ListRow";
import { RowList } from "../../ui/RowList";

const text = cabinet.teacher.finance.debts;

type Variant = "default" | "lime";

function SentButton({ done, label, onClick, variant = "default" }: { done: boolean; label: string; onClick: () => void; variant?: Variant }) {
  return done ? (
    <Button size="sm" icon={Check} disabled>
      {text.sent}
    </Button>
  ) : (
    <Button size="sm" variant={variant} onClick={onClick}>
      {label}
    </Button>
  );
}

export function DebtsCard({ data, onRecord }: { data: FinanceOverview; onRecord: (studentId: string) => void }) {
  const [sent, setSent] = useState<string[]>([]);
  const ending = data.packages.filter((item) => item.ending);
  const keyOf = (kind: "debt" | "package", studentId: string) => `${kind}:${studentId}`;
  const targets = [...data.debtors.map((item) => keyOf("debt", item.studentId)), ...ending.map((item) => keyOf("package", item.studentId))];
  const allSent = targets.length > 0 && targets.every((key) => sent.includes(key));
  const mark = (keys: string[]) => setSent((current) => [...new Set([...current, ...keys])]);

  return (
    <Card title={text.title} action={targets.length > 0 && <SentButton done={allSent} variant="lime" label={text.remindAll} onClick={() => mark(targets)} />}>
      {targets.length === 0 ? (
        <p className="m-0 py-6 text-center text-base font-semibold text-muted-foreground">{text.empty}</p>
      ) : (
        <RowList>
          {data.debtors.map((item) => {
            const student = getStudent(item.studentId);
            const key = keyOf("debt", item.studentId);
            return (
              <ListRow
                key={key}
                large
                lead={<Avatar initials={student.initials} color={student.color} />}
                title={student.name}
                note={<span className="font-bold text-destructive tabular-nums">{text.debtNote(formatRubles(item.amount), item.days, item.payer)}</span>}
              >
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="primary" onClick={() => onRecord(item.studentId)}>
                    {text.record}
                  </Button>
                  <SentButton done={sent.includes(key)} label={text.remind} onClick={() => mark([key])} />
                </div>
              </ListRow>
            );
          })}
          {ending.map((item) => {
            const student = getStudent(item.studentId);
            const key = keyOf("package", item.studentId);
            return (
              <ListRow
                key={key}
                large
                lead={<Avatar initials={student.initials} color={student.color} />}
                title={student.name}
                note={<span className="tabular-nums">{text.packageEnding(item.left)}</span>}
              >
                <SentButton done={sent.includes(key)} label={text.renew} onClick={() => mark([key])} />
              </ListRow>
            );
          })}
        </RowList>
      )}
    </Card>
  );
}
