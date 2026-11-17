import type { ReactNode } from "react";
import { cx } from "./cx";

type Props = { title: ReactNode; note?: ReactNode; lead?: ReactNode; children?: ReactNode; muted?: boolean };

export function ListRow({ title, note, lead, children, muted }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      {lead}
      <div className="min-w-40 flex-1">
        <b className={cx("block text-sm", muted && "text-muted-foreground")}>{title}</b>
        {note && <span className="text-xs font-semibold text-muted-foreground">{note}</span>}
      </div>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
