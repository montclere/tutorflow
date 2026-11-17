import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Props = { columns: string[]; minWidth: number; label?: string; children: ReactNode };

export function DataTable({ columns, minWidth, label, children }: Props) {
  return (
    <table className={styles.table} style={{ minWidth }} aria-label={label}>
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th key={index} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
