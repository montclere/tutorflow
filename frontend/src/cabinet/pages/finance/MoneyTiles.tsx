import { CircleAlert, Hourglass, Wallet, type LucideIcon } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import type { FinanceOverview } from "../../mocks/types";
import { formatRubles } from "../../model/format";
import { useCountUp } from "../../ui/useMotion";
import styles from "./finance.module.css";

const tiles = cabinet.teacher.finance.tiles;
const ROUND = 100;

type TileProps = { icon: LucideIcon; label: string; amount: number; note: string; tone: "received" | "expected" | "debt" };

function Tile({ icon: Icon, label, amount, note, tone }: TileProps) {
  const shown = useCountUp(amount);
  return <div className={`${styles.tile} ${styles[tone]}`}>
    <span className={styles.tileIcon}><Icon aria-hidden="true" /></span>
    <div className={styles.tileCopy}>
      <span className={styles.tileLabel}>{label}</span>
      <b>{formatRubles(Math.round(shown / ROUND) * ROUND)}</b>
      <span className={styles.tileNote}>{note}</span>
    </div>
  </div>;
}

/** Три первичных показателя из прежней финансовой модели (FINANCE-UI-1). */
export function MoneyTiles({ data }: { data: FinanceOverview }) {
  return <div className={styles.tiles}>
    <Tile icon={Wallet} tone="received" label={tiles.received.label} amount={data.stat?.received ?? 0} note={tiles.received.note(data.stat?.payments ?? 0)} />
    <Tile icon={Hourglass} tone="expected" label={tiles.expected.label} amount={data.expected.amount} note={tiles.expected.note} />
    <Tile icon={CircleAlert} tone="debt" label={tiles.debt.label} amount={data.debt.amount} note={tiles.debt.note(data.debt.count)} />
  </div>;
}
