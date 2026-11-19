import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = { title: string; text?: string; action?: ReactNode; icon?: LucideIcon };

/** Пустой экран: иконка на пастельном круге задаёт настроение — «всё сделано», «ничего не найдено» (VIBE-9). */
export function EmptyState({ title, text, action, icon: Icon }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      {Icon && (
        <span className="mb-1 grid size-14 place-items-center rounded-full bg-[var(--vibe-lavender)] text-[var(--color-blue)]" aria-hidden="true">
          <Icon size={26} strokeWidth={2.2} />
        </span>
      )}
      <p className="m-0 font-[family-name:var(--font-display)] text-base font-extrabold">{title}</p>
      {text && <p className="m-0 max-w-sm text-sm font-semibold text-muted-foreground">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
