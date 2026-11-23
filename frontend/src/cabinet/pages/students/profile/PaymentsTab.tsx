import { ArrowDownLeft, BellRing, GraduationCap, Layers, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../../content/cabinet.ru";
import { getStudentDetails } from "../../../data";
import type { Student } from "../../../mocks/types";
import { formatShortDate } from "../../../model/dates";
import { formatRubles, formatSigned } from "../../../model/format";
import { paymentHistory, type PaymentFilter } from "../../../model/studentPayments";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";
import { useNotifier } from "../../../ui/Notifications";
import { balanceNote, formatBalance } from "../StudentsTable";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import styles from "./profile-records.module.css";

const text = cabinet.teacher.students.profile.payments;

export function PaymentsTab({ student, onAdd }: { student: Student; onAdd: () => void }) {
  const { notifySoon } = useNotifier();
  const { payments } = getStudentDetails(student.id);
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const shown = paymentHistory(payments, filter);
  const note = balanceNote(student);
  const pack = student.payment.model === "package" ? student.payment.package : undefined;
  const price = formatRubles(student.payment.pricePerLesson);
  return <div className={styles.paymentsLayout}>
    <div className={styles.paymentCards}>
      <section className={`${styles.panel} ${styles.balanceCard}`} aria-label={text.balance}>
        <span className={styles.sectionIcon}><Wallet aria-hidden="true" /></span>
        <div className={styles.balanceInfo}><h3>{text.balance}</h3><b className={cx(styles.balance, student.balance < 0 ? styles.negative : student.balance > 0 ? styles.positive : "")}>{student.balance === 0 ? formatRubles(0) : formatBalance(student.balance)}</b><p data-warning={note?.warn}>{note ? note.text : text.zero}</p></div>
        <div className={styles.balanceActions}><Button variant="primary" icon={Plus} onClick={onAdd}>{text.add}</Button>{student.balance < 0 && <Button size="sm" icon={BellRing} onClick={() => notifySoon(text.reminded)}>{text.remind}</Button>}</div>
      </section>
      <section className={`${styles.panel} ${styles.tariffCard}`} aria-label={text.tariff}>
        <span className={styles.sectionIcon}><Layers aria-hidden="true" /></span>
        <div className={styles.tariffInfo}><h3>{text.tariff}</h3><b>{pack ? text.package(pack.lessons, price) : text.perLesson(price)}</b>
          {pack && <div className={styles.packageLeft}><span>{text.packageLeft(pack.left, pack.lessons)}</span><span className={styles.packageTrack} aria-hidden="true"><span data-ending={pack.left <= 1} style={{ width: `${(pack.left / Math.max(pack.lessons, 1)) * 100}%` }} /></span></div>}
          <p>{text.lessonsDone(student.lessonsCount)}</p>
        </div>
      </section>
    </div>
    <section className={styles.panel} aria-labelledby="student-payments-title">
      <header className={styles.panelHeader}><h3 id="student-payments-title">{text.history}</h3><ToggleGroup type="single" spacing={1} value={filter} aria-label={text.filterLabel} className={styles.filters} onValueChange={(value) => value && setFilter(value as PaymentFilter)}>{(Object.keys(text.filters) as PaymentFilter[]).map((id) => <ToggleGroupItem key={id} value={id}>{text.filters[id]}</ToggleGroupItem>)}</ToggleGroup></header>
      {shown.length === 0 ? <div className={styles.empty}><Wallet aria-hidden="true" /><p>{payments.length === 0 ? text.empty : text.filterEmpty}</p></div> : <ul className={styles.paymentList}>{shown.map((move, index) => {
        const income = move.amount > 0;
        const Icon = income ? ArrowDownLeft : GraduationCap;
        return <li key={`${move.date}-${move.title}-${move.amount}-${index}`} className={styles.paymentRow}><span className={cx(styles.operationIcon, income && styles.incomeIcon)}><Icon aria-hidden="true" /></span><span className={styles.operationInfo}><b>{move.title}</b><span>{formatShortDate(move.date)} · {income ? text.kinds.payment : text.kinds.lesson}</span></span><b className={cx(styles.amount, income && styles.positive)}>{formatSigned(move.amount)}</b></li>;
      })}</ul>}
    </section>
  </div>;
}
