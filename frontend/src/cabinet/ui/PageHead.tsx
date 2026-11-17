import type { ReactNode } from "react";

type Props = { title: string; subtitle: string; actions?: ReactNode };

export function PageHead({ title, subtitle, actions }: Props) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="m-0 mb-1 font-[family-name:var(--font-display)] text-2xl leading-tight font-black tracking-tight text-balance max-[520px]:text-xl">{title}</h1>
        <p className="m-0 text-sm font-semibold text-muted-foreground">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
