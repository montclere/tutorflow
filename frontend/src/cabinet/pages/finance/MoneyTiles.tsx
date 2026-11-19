import { Hourglass, PiggyBank, Wallet, WarningCircle } from "@phosphor-icons/react";
import type { AppIcon } from "@/shared/ui/icon";
import { cabinet } from "../../content/cabinet.ru";
import type { FinanceOverview } from "../../mocks/types";
import { formatRubles } from "../../model/format";
import { monthIndex, shiftMonth } from "../../model/finance";
import { cx } from "../../ui/cx";
import { GradientIcon, type GradientTone } from "@/shared/ui/GradientIcon";
import { useCountUp } from "../../ui/useMotion";
import styles from "./finance.module.css";

const tiles = cabinet.teacher.finance.tiles;
const received = cabinet.teacher.finance.received;
const ROUND = 100;

const rubles = (kopecks: number) => formatRubles(Math.round(kopecks / ROUND) * ROUND);

type TileProps = { icon: AppIcon; label: string; amount: number; note: string; tone?: "main" | "bad"; vibe?: GradientTone; badge?: string | null; delay: number };

/** Пастельный фон под цвет градиентной иконки (VIBE-8); у пустого долга — обычная карточка. */
const pastel: Partial<Record<GradientTone, string>> = { cyan: "bg-[var(--vibe-sky)]", pink: "bg-[var(--vibe-pink)]", green: "bg-[var(--vibe-mint)]" };

function Tile({ icon: Icon, label, amount, note, tone, vibe, badge, delay }: TileProps) {
  const shown = useCountUp(amount);
  return (
    <div
      className={cx(
        "grid content-start gap-3 rounded-2xl border p-5 max-[520px]:gap-2 max-[520px]:p-3.5",
        styles.rise,
        tone === "main" ? "border-primary bg-primary text-primary-foreground" : vibe && (tone !== "bad" || amount > 0) ? cx("border-transparent", pastel[vibe]) : "bg-card",
      )}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
    >
      <div className="flex items-center justify-between gap-2">
        {vibe ? (
          <GradientIcon icon={Icon} tone={vibe} size={40} />
        ) : (
          <span className="grid size-10 place-items-center rounded-xl bg-white/15 max-[520px]:size-8">
            <Icon size={20} aria-hidden="true" />
          </span>
        )}
        {badge && <span className="rounded-full bg-highlight px-2.5 py-1 text-xs max-[520px]:px-2 max-[520px]:text-[10px] font-extrabold text-highlight-foreground tabular-nums">{badge}</span>}
      </div>
      <div className="grid gap-0.5">
        <span className={cx("text-sm font-bold", tone === "main" ? "text-primary-foreground/80" : "text-muted-foreground")}>{label}</span>
        <b className={cx("font-[family-name:var(--font-display)] text-2xl leading-tight font-black tracking-tight tabular-nums max-[520px]:text-lg", tone === "bad" && amount > 0 && "text-destructive")}>{rubles(shown)}</b>
        <span className={cx("text-xs font-bold tabular-nums", tone === "main" ? "text-primary-foreground/80" : "text-muted-foreground")}>{note}</span>
      </div>
    </div>
  );
}

/** Четыре числа месяца: получено, ожидается, должны, оплачено вперёд (FINANCE-1). */
export function MoneyTiles({ data }: { data: FinanceOverview }) {
  const growth = data.receivedGrowth === null ? null : received.growth(data.receivedGrowth, monthIndex(shiftMonth(data.month, -1)));
  return (
    <div className="grid grid-cols-4 gap-4 max-[1180px]:grid-cols-2 max-[520px]:gap-2.5">
      <Tile icon={Wallet} tone="main" label={tiles.received.label} amount={data.stat?.received ?? 0} note={tiles.received.note(data.stat?.payments ?? 0)} badge={growth} delay={0} />
      <Tile icon={Hourglass} vibe="cyan" label={tiles.expected.label} amount={data.expected.amount} note={tiles.expected.note} delay={80} />
      <Tile icon={WarningCircle} tone="bad" vibe="pink" label={tiles.debt.label} amount={data.debt.amount} note={tiles.debt.note(data.debt.count)} delay={160} />
      <Tile icon={PiggyBank} vibe="green" label={tiles.prepaid.label} amount={data.prepaid.amount} note={tiles.prepaid.note(data.prepaid.lessons)} delay={240} />
    </div>
  );
}
