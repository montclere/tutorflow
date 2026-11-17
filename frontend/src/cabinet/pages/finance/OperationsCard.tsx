import { Search } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { FinanceOperation } from "../../mocks/types";
import { formatShortDate } from "../../model/dates";
import { filterOperations, type OperationFilter } from "../../model/finance";
import { formatSigned } from "../../model/format";
import { Avatar } from "../../ui/Avatar";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { EmptyState } from "../../ui/EmptyState";
import { TruncatedText } from "../../ui/TruncatedText";
import { Input } from "@/shared/ui/kit/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/kit/table";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";

const text = cabinet.teacher.finance.operations;

function Amount({ value }: { value: number }) {
  return (
    <b className={cx("font-[family-name:var(--font-display)] text-base font-extrabold whitespace-nowrap tabular-nums", value > 0 && "text-success")}>{formatSigned(value)}</b>
  );
}

function methodOf(operation: FinanceOperation): string {
  return operation.method ? text.methods[operation.method] : text.noMethod;
}

export function OperationsCard({ operations }: { operations: FinanceOperation[] }) {
  const [filter, setFilter] = useState<OperationFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = filterOperations(operations, filter, query, (id) => getStudent(id).name);

  return (
    <Card title={text.title}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup
            type="single"
            value={filter}
            spacing={1}
            aria-label={text.filterLabel}
            className="gap-1 rounded-lg border bg-card p-1 max-[520px]:w-full"
            onValueChange={(value) => value && setFilter(value as OperationFilter)}
          >
            {text.filters.map((item) => (
              <ToggleGroupItem key={item.id} value={item.id} className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground max-[520px]:flex-1">
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="relative min-w-0 max-[520px]:w-full">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
              <div className="overflow-hidden rounded-xl border">
                <Table aria-label={text.listLabel}>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {text.columns.map((column, index) => (
                        <TableHead key={column} className={cx("h-11 bg-secondary px-4 text-sm font-bold text-muted-foreground first:pl-5 last:pr-5", index === 4 && "text-right")}>
                          {column}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((operation) => {
                      const student = getStudent(operation.studentId);
                      return (
                        <TableRow key={operation.id}>
                          <TableCell className="px-4 py-3 pl-5 text-base font-bold whitespace-nowrap text-muted-foreground tabular-nums">{formatShortDate(operation.date)}</TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar initials={student.initials} color={student.color} />
                              <span className="text-base font-extrabold whitespace-nowrap">{student.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-64 px-4 py-3 text-base font-semibold">
                            <TruncatedText text={operation.title} />
                          </TableCell>
                          <TableCell className="px-4 py-3 text-base font-semibold whitespace-nowrap text-muted-foreground">{methodOf(operation)}</TableCell>
                          <TableCell className="px-4 py-3 pr-5 text-right">
                            <Amount value={operation.amount} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <ul className="m-0 hidden list-none flex-col gap-2 p-0 max-[520px]:flex" aria-label={text.listLabel}>
              {filtered.map((operation) => {
                const student = getStudent(operation.studentId);
                return (
                  <li key={operation.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <Avatar initials={student.initials} color={student.color} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-base font-extrabold">{student.name}</b>
                      <span className="block truncate text-sm font-semibold text-muted-foreground">{operation.title}</span>
                      <span className="block text-sm font-semibold text-muted-foreground tabular-nums">
                        {[formatShortDate(operation.date), operation.method ? methodOf(operation) : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Amount value={operation.amount} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
