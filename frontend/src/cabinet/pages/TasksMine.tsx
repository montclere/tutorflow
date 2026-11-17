import { cabinet } from "../content/cabinet.ru";
import { getTaskLab } from "../data";
import { Button } from "../ui/Button";
import { useNotifier } from "../ui/Notifications";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/kit/table";

const text = cabinet.teacher.tasks.mine;
const numberColumns = [1, 3];

export function TasksMine() {
  const { notifySoon } = useNotifier();

  return (
    <div className="rounded-xl border bg-card">
      <Table aria-label={cabinet.teacher.tasks.tabs[2]?.label}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {text.columns.map((column, index) => (
              <TableHead
                key={index}
                className={`h-11 px-4 text-xs font-extrabold tracking-wide text-muted-foreground uppercase first:pl-5 last:pr-5 ${numberColumns.includes(index) ? "text-right" : ""}`}
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {getTaskLab().mine.map((task) => (
            <TableRow key={task.title} className="transition-colors duration-150 motion-reduce:transition-none">
              <TableCell className="px-4 py-3 pl-5 text-sm font-extrabold">{task.title}</TableCell>
              <TableCell className="px-4 py-3 text-right font-[family-name:var(--font-display)] text-sm font-extrabold tabular-nums">{task.cards}</TableCell>
              <TableCell className="px-4 py-3 text-sm font-semibold text-muted-foreground">{task.assigned}</TableCell>
              <TableCell className="px-4 py-3 text-right font-[family-name:var(--font-display)] text-sm font-extrabold tabular-nums">{task.average}</TableCell>
              <TableCell className="px-4 py-3 pr-5 text-right">
                <Button size="sm" onClick={() => notifySoon(text.assign)}>
                  {text.assign}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
