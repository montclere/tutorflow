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

type Kind = "debt" | "package";

function SentButton({ done, label, onClick }: { done: boolean; label: string; onClick: () => void }) {
  return done ? (
    <Button size="sm" icon={Check} disabled>
      {text.sent}
    </Button>
  ) : (
    <Button size="sm" onClick={onClick}>
      {label}
    </Button>
  );
}

function Caption({ children }: { children: string }) {
  return <h3 className="m-0 mb-1 text-xs font-extrabold tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

export function DebtsCard({ data }: { data: FinanceOverview }) {
  const [sent, setSent] = useState<string[]>([]);
  const ending = data.packages.filter((item) => item.ending);
  const healthy = data.packages.filter((item) => !item.ending);
  const keyOf = (kind: Kind, studentId: string) => `${kind}:${studentId}`;
  const targets = [...data.debtors.map((item) => keyOf("debt", item.studentId)), ...ending.map((item) => keyOf("package", item.studentId))];
  const allSent = targets.length > 0 && targets.every((key) => sent.includes(key));
  const mark = (keys: string[]) => setSent((current) => [...new Set([...current, ...keys])]);

  return (
    <Card title={text.title} action={targets.length > 0 && <SentButton done={allSent} label={text.remindAll} onClick={() => mark(targets)} />}>
      {targets.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm font-semibold text-muted-foreground">{text.empty}</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {data.debtors.length > 0 && (
            <section>
              <Caption>{text.debtors}</Caption>
              <RowList>
                {data.debtors.map((item) => {
                  const student = getStudent(item.studentId);
                  const key = keyOf("debt", item.studentId);
                  return (
                    <ListRow
                      key={key}
                      lead={<Avatar initials={student.initials} color={student.color} />}
                      title={student.name}
                      note={<span className="font-bold text-destructive tabular-nums">{text.debtNote(formatRubles(item.amount), item.days)}</span>}
                    >
                      <SentButton done={sent.includes(key)} label={text.remind} onClick={() => mark([key])} />
                    </ListRow>
                  );
                })}
              </RowList>
            </section>
          )}
          {data.packages.length > 0 && (
            <section>
              <Caption>{text.packages}</Caption>
              <RowList>
                {[...ending, ...healthy].map((item) => {
                  const student = getStudent(item.studentId);
                  const key = keyOf("package", item.studentId);
                  return (
                    <ListRow
                      key={key}
                      lead={<Avatar initials={student.initials} color={student.color} />}
                      title={student.name}
                      note={<span className="tabular-nums">{item.ending ? text.packageEnding(item.left) : text.packageOk}</span>}
                    >
                      {item.ending && <SentButton done={sent.includes(key)} label={text.renew} onClick={() => mark([key])} />}
                    </ListRow>
                  );
                })}
              </RowList>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
