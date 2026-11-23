import { MagnifyingGlass, Receipt } from "@phosphor-icons/react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useId, useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { FinanceOperation } from "../../mocks/types";
import { formatShortDate } from "../../model/dates";
import { filterOperations, type OperationFilter } from "../../model/finance";
import { formatSigned } from "../../model/format";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { TruncatedText } from "../../ui/TruncatedText";
import { Input } from "@/shared/ui/kit/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/kit/table";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import styles from "./finance.module.css";

const text = cabinet.teacher.finance.operations;

export function OperationsCard({ operations }: { operations: FinanceOperation[] }) {
  const [filter, setFilter] = useState<OperationFilter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const tableId = useId();
  const filtered = filterOperations(operations, filter, query, (id) => getStudent(id).name);
  const hasMore = filtered.length > text.collapsedRows;
  const visible = expanded ? filtered : filtered.slice(0, text.collapsedRows);

  return <Card className={`${styles.card} ${styles.operationsCard}`}>
    <div className={styles.operationsHeader}>
      <h2>{text.title}</h2>
      <ToggleGroup type="single" value={filter} spacing={1} aria-label={text.filterLabel} className={styles.filters} onValueChange={(value) => value && setFilter(value as OperationFilter)}>
        {text.filters.map((item) => <ToggleGroupItem key={item.id} value={item.id}>{item.label}</ToggleGroupItem>)}
      </ToggleGroup>
      <div className={styles.search}>
        <Search size={16} aria-hidden="true" />
        <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.searchPlaceholder} aria-label={text.searchLabel} />
      </div>
    </div>
    {filtered.length === 0 ? <EmptyState icon={operations.length === 0 ? Receipt : MagnifyingGlass} title={operations.length === 0 ? text.emptyMonth : text.emptySearch} /> : <>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Область прокрутки таблицы доступна с клавиатуры, в том числе на узком экране. */}
      <div className={styles.tableScroll} id={tableId} role="region" aria-label={text.listLabel} tabIndex={0}>
        <Table aria-label={text.listLabel}>
          <TableHeader><TableRow>{text.columns.map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{visible.map((operation) => {
            const student = getStudent(operation.studentId);
            return <TableRow key={operation.id}>
              <TableCell className={styles.operationDate}>{formatShortDate(operation.date)}</TableCell>
              <TableCell><div className={styles.operationPerson}><Avatar initials={student.initials} color={student.color} /><span>{student.name}</span></div></TableCell>
              <TableCell><div className={styles.operationDescription}><TruncatedText text={operation.title} />{operation.method && <span className={styles.method}>{text.methods[operation.method]}</span>}</div></TableCell>
              <TableCell><b className={operation.amount > 0 ? styles.positive : styles.amount}>{formatSigned(operation.amount)}</b></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
      </div>
      {hasMore && <div className={styles.expand}><Button icon={expanded ? ChevronUp : ChevronDown} aria-controls={tableId} aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? text.collapse : text.showAll(filtered.length)}</Button></div>}
    </>}
  </Card>;
}
