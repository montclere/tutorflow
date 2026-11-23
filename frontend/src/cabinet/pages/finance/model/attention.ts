import type { DebtorRow, FinanceOverview, PackageRow } from "../../../mocks/types";

export type AttentionItem =
  | { kind: "debt"; key: string; row: DebtorRow }
  | { kind: "package"; key: string; row: PackageRow }
  | { kind: "expected"; key: string; month: string; lessons: number };

export function attentionItems(data: Pick<FinanceOverview, "debtors" | "packages" | "expected" | "month">): AttentionItem[] {
  return [
    ...data.debtors.map((row): AttentionItem => ({ kind: "debt", key: `debt:${row.studentId}`, row })),
    ...data.packages.filter((row) => row.ending).map((row): AttentionItem => ({ kind: "package", key: `package:${row.studentId}`, row })),
    ...(data.expected.lessons > 0 ? [{ kind: "expected" as const, key: `expected:${data.month}`, month: data.month, lessons: data.expected.lessons }] : []),
  ];
}
