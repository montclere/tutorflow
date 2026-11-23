import { CalendarDays } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import { formatDayMonth } from "../../model/dates";
import styles from "./overview.module.css";

export function MainHeading({ today }: { today: string }) {
  return <header className={styles.heading}><h1>{cabinet.teacher.overview.mainTitle}</h1><span className={styles.date}><CalendarDays size={19} aria-hidden="true" />{cabinet.teacher.overview.mainDate(formatDayMonth(today))}</span></header>;
}
