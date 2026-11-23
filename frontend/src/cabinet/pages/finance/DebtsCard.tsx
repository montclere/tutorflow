import { CalendarDays, Check, CircleCheck, Ellipsis } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { FinanceOverview } from "../../mocks/types";
import { formatRubles } from "../../model/format";
import { monthIndex } from "../../model/finance";
import { teacherRoutes } from "../../../config/routes";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { CabinetLink } from "../../ui/CabinetLink";
import { Card } from "../../ui/Card";
import { useNotifier } from "../../ui/Notifications";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/shared/ui/kit/dialog";
import { attentionItems, type AttentionItem } from "./model/attention";
import styles from "./finance.module.css";

const text = cabinet.teacher.finance.debts;
const attention = cabinet.teacher.finance.attention;
const PREVIEW_ROWS = 3;

export function DebtsCard({ data, onRecord }: { data: FinanceOverview; onRecord: (studentId: string) => void }) {
  const [allOpen, setAllOpen] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const { notify } = useNotifier();
  const items = attentionItems(data);
  const targets = items.filter((item) => item.kind !== "expected").map((item) => item.key);
  const allSent = targets.length > 0 && targets.every((key) => sent.includes(key));
  const mark = (keys: string[], renewal = false) => {
    setSent((current) => [...new Set([...current, ...keys])]);
    notify(renewal ? attention.renewalMarked : attention.remindMarked);
  };
  const renderItem = (item: AttentionItem, full = false) => {
    if (item.kind === "expected") return <li key={item.key} className={styles.attentionRow}>
      <span className={styles.expectedIcon}><CalendarDays aria-hidden="true" /></span>
      <p className={styles.person}><b>{attention.expected(item.lessons, cabinet.teacher.finance.monthNames[monthIndex(item.month)] ?? item.month)}</b></p>
      <CabinetLink className={styles.inspect} href={`${teacherRoutes.schedule}?view=month&date=${item.month}-01`} aria-label={attention.inspectLabel} title={attention.expectedHint}>{attention.inspect}</CabinetLink>
    </li>;
    const student = getStudent(item.row.studentId);
    const done = sent.includes(item.key);
    return <li key={item.key} className={styles.attentionRow}>
      <Avatar initials={student.initials} color={student.color} />
      <p className={styles.person}>
        <b>{student.name}</b>
        <span className={item.kind === "debt" ? styles.debtNote : undefined}>{item.kind === "debt" ? text.debtNote(formatRubles(item.row.amount), item.row.days, full ? item.row.payer : null) : text.packageEnding(item.row.left)}</span>
      </p>
      <div className={styles.rowActions}>
        {item.kind === "debt" && <Button size="sm" variant="primary" onClick={() => { setAllOpen(false); requestAnimationFrame(() => onRecord(student.id)); }}>{text.record}</Button>}
        <Button size="sm" icon={done ? Check : undefined} disabled={done} title={attention.demo} onClick={() => mark([item.key], item.kind === "package")}>
          {done ? attention.marked : item.kind === "debt" ? text.remind : text.renew}
        </Button>
      </div>
    </li>;
  };
  return <Card title={attention.title} className={`${styles.card} ${styles.attentionCard}`} action={items.length > 0 && <Dialog open={allOpen} onOpenChange={setAllOpen}>
    <DialogTrigger asChild><Button size="sm" icon={Ellipsis} aria-label={attention.actions}>{items.length > PREVIEW_ROWS ? attention.all(items.length) : null}</Button></DialogTrigger>
    <DialogContent className={styles.attentionDialog}>
      <DialogTitle>{attention.title}</DialogTitle>
      <DialogDescription>{attention.description}</DialogDescription>
      <ul className={styles.attentionList}>{items.map((item) => renderItem(item, true))}</ul>
      <p className={styles.demoNote}>{attention.demo}</p>
      {targets.length > 0 && <Button disabled={allSent} icon={allSent ? Check : undefined} onClick={() => mark(targets)}>{allSent ? attention.marked : text.remindAll}</Button>}
    </DialogContent>
  </Dialog>}>
    {items.length > 0 ? <ul className={styles.attentionList}>{items.slice(0, PREVIEW_ROWS).map((item) => renderItem(item))}</ul> : <div className={styles.emptyAttention}><CircleCheck aria-hidden="true" /><b>{attention.empty}</b><p>{attention.emptyText}</p></div>}
  </Card>;
}
