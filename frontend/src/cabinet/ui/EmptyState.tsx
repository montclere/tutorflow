import type { ReactNode } from "react";

type Props = { title: string; text?: string; action?: ReactNode; emoji?: string };

/** Пустой экран: крупный эмодзи на пастельном круге задаёт настроение — «всё сделано», «ничего не найдено» (VIBE-9). */
export function EmptyState({ title, text, action, emoji }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      {emoji && (
        <span className="mb-1 grid size-16 place-items-center rounded-full bg-[var(--vibe-lavender)] text-[32px] leading-none" aria-hidden="true">
          {emoji}
        </span>
      )}
      <p className="m-0 font-[family-name:var(--font-display)] text-base font-extrabold">{title}</p>
      {text && <p className="m-0 max-w-sm text-sm font-semibold text-muted-foreground">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
