import { ChevronLeft, ChevronRight, Ellipsis, Plus } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getCurrentMonth, getFinanceMonths, getFinanceOverview } from "../../data";
import { shiftMonth } from "../../model/finance";
import { formatMonthTitle } from "../../model/dates";
import { Button, IconButton } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { Button as KitButton } from "@/shared/ui/kit/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/kit/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { DebtsCard } from "./DebtsCard";
import { IncomeChart } from "./IncomeChart";
import { MoneyTiles } from "./MoneyTiles";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { OperationsCard } from "./OperationsCard";
import styles from "./finance.module.css";
import { useFinanceUrl } from "./useFinanceUrl";

const text = cabinet.teacher.finance;

export function FinancePage() {
  const { notifySoon } = useNotifier();
  const months = getFinanceMonths();
  const { month, go } = useFinanceUrl(months, getCurrentMonth());
  const data = getFinanceOverview(month);
  const currentMonth = getCurrentMonth();
  const current = month === currentMonth ? data : getFinanceOverview(currentMonth);
  const [recording, setRecording] = useState<{ studentId: string | null } | null>(null);
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div className={styles.period}>
          <h1>{text.title}<svg viewBox="0 0 160 15" preserveAspectRatio="none" aria-hidden="true"><path d="M2 10 52 3 35 12 101 4 91 10 155 6" /></svg></h1>
          <div className={styles.monthControls}>
            <IconButton icon={ChevronLeft} label={text.prev} disabled={!months.includes(previous)} onClick={() => go(previous)} />
            <Select value={month} onValueChange={go}>
              <SelectTrigger aria-label={text.monthLabel} className={styles.monthSelect}><SelectValue /></SelectTrigger>
              <SelectContent>{months.map((key) => <SelectItem key={key} value={key}>{formatMonthTitle(`${key}-01`)}</SelectItem>)}</SelectContent>
            </Select>
            <IconButton icon={ChevronRight} label={text.next} disabled={!months.includes(next)} onClick={() => go(next)} />
          </div>
        </div>
        <div className={styles.headingActions}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><KitButton variant="secondary" size="icon" aria-label={text.menuLabel}><Ellipsis aria-hidden="true" /></KitButton></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => notifySoon(text.export)}>{text.export}</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
          <Button variant="primary" icon={Plus} onClick={() => setRecording({ studentId: null })}>{text.addPayment}</Button>
        </div>
      </header>
      <MoneyTiles data={data} />
      <div className={styles.middle}>
        <IncomeChart history={data.history} month={month} currentMonth={currentMonth} expected={current.expected.amount} onPick={go} />
        <DebtsCard data={data} onRecord={(studentId) => setRecording({ studentId })} />
      </div>
      <OperationsCard key={month} operations={data.operations} />
      <RecordPaymentDialog open={recording !== null} studentId={recording?.studentId} onClose={() => setRecording(null)} />
    </div>
  );
}
