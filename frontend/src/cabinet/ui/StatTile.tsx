import type { LucideIcon } from "lucide-react";
import { GradientIcon, type GradientTone } from "@/shared/ui/GradientIcon";
import { cx } from "./cx";

const pastel: Record<GradientTone, string> = {
  green: "bg-[var(--vibe-mint)]",
  orange: "bg-[var(--vibe-peach)]",
  pink: "bg-[var(--vibe-pink)]",
  purple: "bg-[var(--vibe-lavender)]",
  cyan: "bg-[var(--vibe-sky)]",
  blue: "bg-[var(--cab-blue-soft)]",
};

type Props = { label: string; value: string; note?: string; tone: GradientTone; icon?: LucideIcon; emoji?: string; className?: string; onClick?: () => void };

/** Плитка-показатель на пастельном фоне: градиентная иконка или эмодзи, число и подпись (VIBE-1). */
export function StatTile({ label, value, note, tone, icon, emoji, className, onClick }: Props) {
  const body = (
    <>
      {icon ? (
        <GradientIcon icon={icon} tone={tone} size={40} />
      ) : (
        <span className="grid size-10 flex-none place-items-center rounded-xl bg-card/80 text-[22px] leading-none" aria-hidden="true">
          {emoji}
        </span>
      )}
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-xs font-bold text-muted-foreground">{label}</span>
        <b className="font-[family-name:var(--font-display)] text-xl leading-tight font-black tabular-nums">{value}</b>
        {note && <span className="truncate text-xs font-semibold text-muted-foreground">{note}</span>}
      </span>
    </>
  );
  const classes = cx("flex min-w-0 items-center gap-3 rounded-2xl p-4 text-left text-foreground", pastel[tone], className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(classes, "appearance-none border-0 [font-family:inherit] transition-transform hover:-translate-y-0.5")}>
      {body}
    </button>
  ) : (
    <div className={classes}>{body}</div>
  );
}
