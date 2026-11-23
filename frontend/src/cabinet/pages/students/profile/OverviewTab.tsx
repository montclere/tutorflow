import { ArrowRight, BarChart3, CalendarDays, CheckSquare, CircleCheck, Coins, MessageCircle, Phone, TrendingUp, UserRound, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { cabinet } from "../../../content/cabinet.ru";
import { getStudentDetails } from "../../../data";
import type { ScheduleLesson, Student } from "../../../mocks/types";
import { formatRubles } from "../../../model/format";
import { overviewHistory, type OverviewPeriod } from "../../../model/studentOverview";
import { homeworkSummary } from "../../../model/studentTasks";
import { attendance, homeworkAverage, paymentStatus } from "../../../model/students";
import { cx } from "../../../ui/cx";
import { Ring } from "../../learn/Ring";
import { nextLessonText } from "../StudentsTable";
import { upcomingLessons } from "./LessonsTab";
import styles from "./overview.module.css";

const profile = cabinet.teacher.students.profile;
const text = profile.overview;
const summary = profile.summary;
export type ProfileTab = (typeof profile.tabs)[number]["id"];

function Card({ title, icon: Icon, action, className, children }: { title: string; icon: LucideIcon; action?: ReactNode; className?: string; children: ReactNode }) {
  return <section className={cx(styles.card, className)}>
    <header className={styles.cardHeader}><h3><Icon aria-hidden="true" />{title}</h3>{action}</header>{children}
  </section>;
}

function Metric({ label, icon: Icon, value, trend = false, hint }: { label: string; icon: LucideIcon; value: number | null; trend?: boolean; hint?: string }) {
  return <div className={styles.metric} title={hint ?? (value === null ? text.noData : undefined)}>
    <Icon aria-hidden="true" /><span>{label}</span>
    <b className={cx(value === null ? styles.missing : value >= (trend ? 0 : 80) ? styles.good : styles.warn, trend && value !== null && styles.delta)}>
      {value === null ? "—" : `${trend && value > 0 ? "+" : ""}${value}${trend ? " п.п." : "%"}`}
    </b>
  </div>;
}

function Contact({ initials, name, role, phone, connected }: { initials: string; name: string; role: string; phone?: string; connected?: boolean }) {
  return <div className={styles.contact}>
    <span className={styles.contactAvatar} aria-hidden="true">{initials}</span>
    <div className={styles.contactPerson}><b>{name}</b><span>{role}</span></div>
    {phone ? <a className={styles.phone} href={`tel:${phone.replace(/[^\d+]/g, "")}`} aria-label={summary.call(phone)}><Phone aria-hidden="true" />{phone}</a> : <span className={styles.phoneMissing}>{text.noPhone}</span>}
    {connected !== undefined && <span className={cx(styles.connection, connected && styles.connected)} title={connected ? profile.telegram.on : profile.telegram.off} aria-label={connected ? profile.telegram.on : profile.telegram.off}><MessageCircle aria-hidden="true" /></span>}
  </div>;
}

type Props = { student: Student; today: string; onOpenLesson: (lesson: ScheduleLesson) => void };

export function OverviewTab({ student, today, onOpenLesson }: Props) {
  const [period, setPeriod] = useState<OverviewPeriod>(14);
  const details = getStudentDetails(student.id);
  const history = overviewHistory(student.recentLessons, details.tasks, today, period);
  const periodStudent = { ...student, recentLessons: history.lessons };
  const trend = homeworkSummary(history.tasks, today).trend;
  const progress = student.exam?.readiness ?? null;
  const next = upcomingLessons(student.id, 1)[0];
  const status = paymentStatus(student);
  const paymentLabel = status === "debt" ? text.debt(formatRubles(student.balance)) : status === "low" ? text.packageLow(student.payment.package?.left ?? 0) : text.paid;
  const parent = student.parent;
  return <div className={styles.grid}>
    <Card title={text.metrics} icon={BarChart3} className={styles.metricsCard} action={
      <Select value={String(period)} onValueChange={(value) => setPeriod(Number(value) as OverviewPeriod)}>
        <SelectTrigger aria-label={text.period} className={styles.period}><SelectValue /></SelectTrigger>
        <SelectContent>{([14, 31] as const).map((days) => <SelectItem key={days} value={String(days)}>{text.periods[days]}</SelectItem>)}</SelectContent>
      </Select>
    }>
      <div className={styles.metrics}>
        <div className={styles.progress} title={progress === null ? text.noData : text.overallHint}>
          <Ring value={progress ?? 0} size={132} stroke={12} track="var(--vibe-lavender)" label={progress === null ? text.noData : summary.readiness(progress)}><b>{progress === null ? "—" : `${progress}%`}</b></Ring><span>{text.overall}</span>
        </div>
        <Metric label={text.attendance} icon={CalendarDays} value={attendance(periodStudent)} />
        <Metric label={text.homework} icon={CheckSquare} value={homeworkAverage(periodStudent)} />
        <Metric label={text.trend} icon={TrendingUp} value={trend} trend hint={text.trendHint} />
      </div>
    </Card>
    <Card title={summary.payment} icon={Coins} className={styles.paymentCard}>
      <div className={styles.priceRow}><div className={styles.price}><b>{formatRubles(student.payment.pricePerLesson)}</b><span>{text.perLesson}</span></div><span className={cx(styles.paymentStatus, status === "paid" ? styles.paid : status === "debt" ? styles.debt : styles.low)}>{status === "paid" && <CircleCheck aria-hidden="true" />}{paymentLabel}</span></div>
      <div className={styles.paymentDetails}>
        <div><CalendarDays aria-hidden="true" /><span>{summary.tariff}<b>{student.payment.model === "package" ? cabinet.teacher.students.payment.package : cabinet.teacher.students.payment.perLesson}</b></span></div>
        <div><Coins aria-hidden="true" /><span>{summary.doneShort}<b>{text.conducted(student.lessonsCount)}</b></span></div>
      </div>
    </Card>
    <Card title={text.next} icon={CalendarDays} className={styles.lessonCard}>
      {next ? <div className={styles.nextLesson}>
        <div><b>{nextLessonText({ ...student, nextLesson: next }, today)}</b><span>{student.schedule.time === cabinet.teacher.students.mixedTime ? summary.mixedTime : next.start} · {summary.duration(next.durationMin)}</span></div>
        <button type="button" className={styles.openLesson} aria-label={text.openLesson} onClick={() => onOpenLesson(next)}><ArrowRight aria-hidden="true" /></button>
      </div> : <p className={styles.empty}>{text.noUpcoming}</p>}
    </Card>
    <Card title={summary.contacts} icon={UserRound} className={styles.contactsCard}>
      <div className={styles.contacts}>
        {parent && <Contact initials={parent.name.split(" ").map((part) => part[0]).join("").slice(0, 2)} name={parent.name} role={parent.relation} phone={parent.phone} />}
        <Contact initials={student.initials} name={student.name} role={text.studentRole} connected={student.telegramConnected} />
      </div>
    </Card>
  </div>;
}
