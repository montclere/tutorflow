import { CalendarDays, ChevronRight, Coins, Paperclip, Plus, type LucideIcon } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { formatLongDay } from "../../model/dates";
import { formatSigned } from "../../model/format";
import type { StudentColor } from "../../mocks/types";
import { Avatar } from "../../ui/Avatar";
import { CabinetLink } from "../../ui/CabinetLink";
import { SheetDescription, SheetTitle } from "@/shared/ui/kit/sheet";
import { cx } from "../../ui/cx";
import styles from "./lesson-details.module.css";

const text = cabinet.teacher.schedule.lesson;

/** Radix без SheetTrigger: запоминаем вызвавшее событие до автоматического фокуса панели. */
export function useLessonFocus() {
  const origin = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => { origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; },
    onCloseAutoFocus: (event: Event) => { if (origin.current?.isConnected) { event.preventDefault(); origin.current.focus(); } },
  };
}

type HeaderProps = {
  date: string; time: string; countdown?: string | null; balance?: number;
  name: string; goal?: string; initials: string; color: StudentColor; studentHref: string; children?: ReactNode;
};

export function LessonDetailsHeader({ date, time, countdown, balance, name, goal, initials, color, studentHref, children }: HeaderProps) {
  return <header className={styles.header}>
    <SheetDescription className={styles.date}><CalendarDays size={20} aria-hidden="true" />{formatLongDay(date)}</SheetDescription>
    <div className={styles.timeRow}>
      <div className={styles.timeGroup}><b className={styles.time}>{time}</b>{countdown && <span className={styles.countdown}>{countdown}</span>}</div>
      {balance !== undefined && <div className={cx(styles.balance, balance > 0 ? styles.positive : balance < 0 ? styles.negative : styles.neutral)}>
        <Coins size={24} aria-hidden="true" /><span><small>{text.balanceLabel}</small><b>{formatSigned(balance)}</b></span>
      </div>}
    </div>
    <CabinetLink href={studentHref} className={styles.student}>
      <Avatar initials={initials} color={color} />
      <span><SheetTitle className={styles.name}>{name}</SheetTitle>{goal && <small>{goal}</small>}</span>
      <ChevronRight size={22} aria-hidden="true" />
    </CabinetLink>
    <div className={styles.chips}>{children}</div>
  </header>;
}

export function LessonDetailsRow({ icon: Icon, label, children, aside, note = false }: { icon: LucideIcon; label: string; children: ReactNode; aside?: ReactNode; note?: boolean }) {
  return <section className={cx(styles.row, note && styles.note)}>
    <span className={styles.rowIcon}><Icon size={23} aria-hidden="true" /></span>
    <div className={styles.rowText}><h3>{label}</h3><div>{children}</div></div>
    {aside && <div className={styles.rowAside}>{aside}</div>}
  </section>;
}

/** Интеграционная граница: обработчик должен привязать реальные файлы к переданному lessonId.
 * Пока адаптер хранения отсутствует, выбор файла не запускается и успех не показывается. */
export function LessonMaterialsSection({ lessonId, onAdd }: { lessonId: string; onAdd?: (lessonId: string) => void }) {
  return <LessonDetailsRow icon={Paperclip} label={text.materialsLabel} aside={<button type="button" className={styles.add} disabled={!onAdd} onClick={() => onAdd?.(lessonId)} aria-describedby={`lesson-files-${lessonId}`}><Plus size={17} aria-hidden="true" />{text.addMaterial}</button>}>
    <p id={`lesson-files-${lessonId}`} className={styles.unavailable}>{text.materialsUnavailable}</p>
    <small className={styles.hint}>{text.materialsHint}</small>
  </LessonDetailsRow>;
}
