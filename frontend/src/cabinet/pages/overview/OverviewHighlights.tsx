import { CalendarDays, ClipboardCheck, Clock, Wallet } from "lucide-react";
import { navigate } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import { cabinet } from "../../content/cabinet.ru";
import { getStudents } from "../../data";
import type { TeacherOverview } from "../../mocks/types";
import { formatRubles } from "../../model/format";
import { useLibrary } from "../../tasks/library";
import { StatTile } from "../../ui/StatTile";

const text = cabinet.teacher.overview.stats;

/** Четыре пастельные плитки дня: уроки, проверка, долги, окна — каждая ведёт в свой раздел (VIBE-5). */
export function OverviewHighlights({ data }: { data: TeacherOverview }) {
  const waiting = useLibrary().assignments.filter((assignment) => assignment.status === "wait").length;
  const left = data.today.filter((row) => !row.past).length;
  const debtors = getStudents().filter((student) => student.status === "active" && student.balance < 0);
  const debt = debtors.reduce((sum, student) => sum - student.balance, 0);

  return (
    <div className="mb-4 grid grid-cols-4 gap-3 max-[1180px]:grid-cols-2">
      <StatTile tone="cyan" icon={CalendarDays} label={text.today} value={String(data.today.length)} note={text.todayNote(left)} onClick={() => navigate(teacherRoutes.schedule)} />
      <StatTile tone="purple" icon={ClipboardCheck} label={text.review} value={String(waiting)} note={text.reviewNote} onClick={() => navigate(teacherRoutes.review)} />
      <StatTile tone="pink" icon={Wallet} label={text.debt} value={formatRubles(debt)} note={text.debtNote(debtors.length)} onClick={() => navigate(teacherRoutes.finance)} />
      <StatTile tone="green" icon={Clock} label={text.windows} value={String(data.week.freeWindows.length)} note={text.windowsNote} onClick={() => navigate(teacherRoutes.schedule)} />
    </div>
  );
}
