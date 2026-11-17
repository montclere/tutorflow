import { Search } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { FinanceOperation } from "../../mocks/types";
import { formatShortDate } from "../../model/dates";
import { filterOperations, type OperationFilter } from "../../model/finance";
import { formatSigned } from "../../model/format";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { EmptyState } from "../../ui/EmptyState";
import { Pill } from "../../ui/Pill";
import { Tabs } from "../../ui/Tabs";
import { TruncatedText } from "../../ui/TruncatedText";
import { Card } from "../../ui/Card";
import { Input } from "@/shared/ui/kit/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/kit/table";

const text = cabinet.teacher.finance.operations;

function Receipt({ operation }: { operation: FinanceOperation }) {
  if (!operation.receipt) return <span className="text-muted-foreground">{text.noMethod}</span>;
  return <Pill tone={operation.receipt === "sent" ? "ok" : "warn"}>{text.receipt[operation.receipt]}</Pill>;
}

function Amount({ value }: { value: number }) {
  return (
    <b className={cx("font-[family-name:var(--font-display)] text-sm font-extrabold whitespace-nowrap tabular-nums", value < 0 ? "text-destructive" : "text-success")}>
      {formatSigned(value)}
    </b>
  );
}

function methodOf(operation: FinanceOperation): string {
  return operation.method ? text.methods[operation.method] : text.noMethod;
}

export function OperationsCard({ operations }: { operations: FinanceOperation[] }) {
  const [filter, setFilter] = useState<OperationFilter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(text.pageSize);

  const filtered = filterOperations(operations, filter, query, (id) => getStudent(id).name);
  const visible = filtered.slice(0, limit);
  const rest = filtered.length - visible.length;

  const changeFilter = (next: string) => {
    setFilter(next as OperationFilter);
    setLimit(text.pageSize);
  };

  const changeQuery = (next: string) => {
    setQuery(next);
    setLimit(text.pageSize);
  };

  return (
    <Card title={text.title}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 max-w-full">
            <Tabs label={text.filterLabel} selectedId={filter} items={text.filters.map((item) => ({ id: item.id, label: item.label }))} onSelect={changeFilter} />
          </div>
          <div className="relative min-w-0 max-[520px]:w-full">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder={text.searchPlaceholder}
              aria-label={text.searchLabel}
              className="h-9 w-60 bg-card pl-9 max-[520px]:w-full"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title={operations.length === 0 ? text.emptyMonth : text.emptySearch} />
        ) : (
          <>
            <div className="max-[520px]:hidden">
              <div className="rounded-xl border">
                <Table aria-label={text.listLabel}>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {text.columns.map((column, index) => (
                        <TableHead
                          key={column}
                          className={cx("h-11 px-4 text-xs font-extrabold tracking-wide text-muted-foreground uppercase first:pl-5 last:pr-5", index === 4 && "text-right")}
                        >
                          {column}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((operation) => {
                      const student = getStudent(operation.studentId);
                      return (
                        <TableRow key={operation.id}>
                          <TableCell className="px-4 py-3 pl-5 text-sm font-bold whitespace-nowrap text-muted-foreground tabular-nums">{formatShortDate(operation.date)}</TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar initials={student.initials} color={student.color} />
                              <span className="text-sm font-extrabold whitespace-nowrap">{student.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-64 px-4 py-3 text-sm font-semibold">
                            <TruncatedText text={operation.title} />
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm font-semibold whitespace-nowrap text-muted-foreground">{methodOf(operation)}</TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            <Amount value={operation.amount} />
                          </TableCell>
                          <TableCell className="px-4 py-3 pr-5">
                            <Receipt operation={operation} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <ul className="m-0 hidden list-none flex-col gap-2 p-0 max-[520px]:flex" aria-label={text.listLabel}>
              {visible.map((operation) => {
                const student = getStudent(operation.studentId);
                return (
                  <li key={operation.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <Avatar initials={student.initials} color={student.color} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm">{student.name}</b>
                      <span className="block truncate text-xs font-semibold text-muted-foreground">{operation.title}</span>
                      <span className="block text-xs font-semibold text-muted-foreground tabular-nums">
                        {formatShortDate(operation.date)} · {methodOf(operation)}
                      </span>
                    </span>
                    <span className="grid justify-items-end gap-1">
                      <Amount value={operation.amount} />
                      <Receipt operation={operation} />
                    </span>
                  </li>
                );
              })}
            </ul>

            {rest > 0 && (
              <div className="flex justify-center">
                <Button onClick={() => setLimit(limit + text.pageSize)}>{text.more(Math.min(rest, text.pageSize))}</Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
