import type { ReactNode } from "react";
import { cx } from "../../../ui/cx";

/** Блок раздела: заголовок, подпись и действие справа. */
export function Panel({ title, hint, action, children, className }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 rounded-2xl border bg-card p-5", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="grid gap-0.5">
          <h3 className="m-0 font-[family-name:var(--font-display)] text-base font-extrabold tracking-tight">{title}</h3>
          {hint && <p className="m-0 text-sm font-semibold text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-xl border border-dashed px-4 py-6 text-center text-sm font-semibold text-muted-foreground">{children}</p>;
}

/** Плитка с числом: подпись, значение и пояснение. */
export function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="grid min-w-0 content-start gap-1 rounded-2xl border bg-card p-4">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      <b
        className={cx(
          "font-[family-name:var(--font-display)] text-2xl leading-tight font-black tabular-nums",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
          tone === "warn" && "text-[var(--cab-warn)]",
        )}
      >
        {value}
      </b>
      {note && <span className="text-xs font-bold text-muted-foreground">{note}</span>}
    </div>
  );
}

/** Ссылка-кнопка «Подробнее →» в шапке блока. */
export function MoreButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="appearance-none border-0 bg-transparent p-0 text-sm font-bold text-primary [font:inherit] hover:underline">
      {children}
    </button>
  );
}

/** Дата слева в строке списка. */
export function DateCell({ children }: { children: ReactNode }) {
  return <span className="w-14 flex-none text-sm font-bold text-muted-foreground tabular-nums">{children}</span>;
}
