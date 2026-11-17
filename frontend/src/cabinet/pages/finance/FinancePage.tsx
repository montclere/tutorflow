import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import { getCurrentMonth, getFinanceMonths, getFinanceOverview } from "../../data";
import { shiftMonth } from "../../model/finance";
import { formatMonthTitle } from "../../model/dates";
import { Button, IconButton } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { DebtsCard } from "./DebtsCard";
import { IncomeChart } from "./IncomeChart";
import { MoneyTiles } from "./MoneyTiles";
import { OperationsCard } from "./OperationsCard";
import { useFinanceUrl } from "./useFinanceUrl";

const text = cabinet.teacher.finance;

export function FinancePage() {
  const { notifySoon } = useNotifier();
  const months = getFinanceMonths();
  const { month, go } = useFinanceUrl(months, getCurrentMonth());
  const data = getFinanceOverview(month);
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          <h1 className="m-0 mr-2 font-[family-name:var(--font-display)] text-2xl leading-tight font-black tracking-tight max-[520px]:text-xl">{formatMonthTitle(`${month}-01`)}</h1>
          <IconButton icon={ChevronLeft} label={text.prev} disabled={!months.includes(previous)} onClick={() => go(previous)} />
          <IconButton icon={ChevronRight} label={text.next} disabled={!months.includes(next)} onClick={() => go(next)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={() => notifySoon(text.export)}>
            {text.export}
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => notifySoon(text.addPayment)}>
            {text.addPayment}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <MoneyTiles data={data} />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1181px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <IncomeChart data={data} onPick={go} />
          <DebtsCard data={data} />
        </div>
        <OperationsCard key={month} operations={data.operations} />
      </div>
    </>
  );
}
