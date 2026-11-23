import { CalendarDays, ClipboardList, Ellipsis, FolderOpen, GraduationCap, LayoutGrid, NotebookPen, Plus, Upload, Wallet, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../../content/cabinet.ru";
import { getSchedule, getStudentDetails, removeStudent, setStudentStatus } from "../../../data";
import type { ScheduleLesson, Student, StudentStatus } from "../../../mocks/types";
import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";
import { useNotifier } from "../../../ui/Notifications";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/kit/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/kit/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/kit/tabs";
import { LessonSheet } from "../../schedule/LessonSheet";
import { AssignWorkDialog } from "../../tasks/AssignWorkDialog";
import { NewLessonSheet, type NewLessonSeed } from "../../schedule/NewLessonSheet";
import { PaymentDialog } from "../PaymentDialog";
import { RemoveStudentDialog } from "../RemoveStudentDialog";
import { LessonsTab } from "./LessonsTab";
import { MaterialDialog } from "./MaterialDialog";
import { MaterialsTab } from "./MaterialsTab";
import { NotesTab } from "./NotesTab";
import { OverviewTab, type ProfileTab } from "./OverviewTab";
import { PaymentsTab } from "./PaymentsTab";
import { ProfileSummary } from "./ProfileSummary";
import { TasksTab } from "./TasksTab";
import styles from "./overview.module.css";
import tabStyles from "./student-tabs.module.css";
import recordStyles from "./profile-records.module.css";

const sheet = cabinet.teacher.students.sheet;
const text = cabinet.teacher.students.profile;

const tabIcons: Record<ProfileTab, LucideIcon> = { overview: LayoutGrid, lessons: CalendarDays, tasks: ClipboardList, materials: FolderOpen, payments: Wallet, notes: NotebookPen };

/** Цвет вкладки: иконка всегда цветная, активная вкладка — таблетка того же тона на стекле (VIBE-18). */
const tabTones: Record<ProfileTab, { icon: string; active: string }> = {
  overview: { icon: "text-[#2346e6]", active: "data-[state=active]:bg-[var(--cab-blue-soft)]" },
  lessons: { icon: "text-[#2a9bff]", active: "data-[state=active]:bg-[var(--vibe-sky)]" },
  tasks: { icon: "text-[#7b4dff]", active: "data-[state=active]:bg-[var(--vibe-lavender)]" },
  materials: { icon: "text-[#12b76a]", active: "data-[state=active]:bg-[var(--vibe-mint)]" },
  payments: { icon: "text-[#f0479d]", active: "data-[state=active]:bg-[var(--vibe-pink)]" },
  notes: { icon: "text-[#ff8a3d]", active: "data-[state=active]:bg-[var(--vibe-peach)]" },
};

type Props = { student: Student | null; onClose: () => void; onCloseAutoFocus: (event: Event) => void };

type Actions = {
  onLesson: (seed: NewLessonSeed) => void;
  onPayment: () => void;
  onMaterial: () => void;
  onTask: () => void;
  onRemove: () => void;
  onOpenLesson: (lesson: ScheduleLesson) => void;
};

function Profile({ student, actions }: { student: Student; actions: Actions }) {
  const { notify } = useNotifier();
  const [tab, setTab] = useState<ProfileTab>("overview");
  const { today } = getSchedule();
  const details = getStudentDetails(student.id);
  const focusedTab = tab === "lessons" || tab === "tasks";
  const recordTab = tab === "materials" || tab === "payments" || tab === "notes";
  // Счётчики на вкладках: что требует внимания или сколько записей внутри.
  const counts: Record<ProfileTab, number | "dot" | null> = {
    overview: null,
    lessons: null,
    tasks: details.tasks.filter((task) => task.status !== "done").length,
    materials: details.materials.length,
    payments: student.balance < 0 ? "dot" : null,
    notes: details.notes.length,
  };

  const moveTo = (status: StudentStatus) => {
    setStudentStatus(student.id, status);
    notify(sheet.statusDone[status](student.name));
  };

  return (
    <>
      <header className="relative flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b px-5 py-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4 max-[640px]:pr-12">
          <Avatar initials={student.initials} color={student.color} large />
          <div className="grid min-w-0 gap-1">
            <DialogTitle className="m-0 font-[family-name:var(--font-display)] text-2xl leading-tight font-black tracking-tight break-words max-[640px]:text-xl">{student.name}</DialogTitle>
            <DialogDescription className="m-0 text-base font-semibold">
              {text.goalLabel(student.goal)}
            </DialogDescription>
          </div>
        </div>
        {/* На телефоне действия — одной строкой с прокруткой, чтобы шапка не съедала экран. */}
        <div className="flex items-center gap-2 max-[640px]:-mx-5 max-[640px]:w-[calc(100%+2.5rem)] max-[640px]:overflow-x-auto max-[640px]:px-5 [&>*]:shrink-0">
          <Button variant="primary" icon={Plus} onClick={() => actions.onLesson({ studentId: student.id })}>
            {text.actions.lesson}
          </Button>
          <Button icon={Plus} onClick={actions.onPayment}>
            {text.actions.payment}
          </Button>
          <Button icon={Plus} onClick={actions.onTask}>
            {text.actions.task}
          </Button>
          <Button icon={Upload} onClick={actions.onMaterial}>
            {text.actions.material}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button icon={Ellipsis} aria-label={text.actions.more} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Пункты зависят от текущего статуса (STUDENTS-4). */}
              {student.status !== "active" && <DropdownMenuItem onSelect={() => moveTo("active")}>{sheet.moreItems.restore}</DropdownMenuItem>}
              {student.status === "active" && <DropdownMenuItem onSelect={() => moveTo("pause")}>{sheet.moreItems.pause}</DropdownMenuItem>}
              {student.status !== "archive" && <DropdownMenuItem onSelect={() => moveTo("archive")}>{sheet.moreItems.archive}</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={actions.onRemove}>
                {sheet.moreItems.remove}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DialogClose asChild>
          <Button icon={X} aria-label={text.close} className="max-[640px]:absolute max-[640px]:top-4 max-[640px]:right-4" />
        </DialogClose>
      </header>

      {/* Каждая вкладка использует свою композицию на полной ширине карточки. */}
      <div className={cx("relative min-h-0 flex-1 overflow-y-auto", tab === "overview" ? styles.overviewBody : focusedTab ? tabStyles.body : recordTab ? recordStyles.body : "lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden")}>
        <Tabs value={tab} onValueChange={(value) => setTab(value as ProfileTab)} className="relative min-w-0 gap-0 lg:overflow-y-auto">
          {tab === "overview" && <GraduationCap className={styles.watermark} aria-hidden="true" />}
          <div className="sticky top-0 z-10 shrink-0 overflow-x-auto bg-background/85 px-5 py-3 backdrop-blur [scrollbar-width:none] sm:px-6">
            <TabsList aria-label={sheet.tabsLabel} className="h-auto w-max max-w-none gap-1.5 overflow-visible rounded-full border-0 bg-transparent p-0">
              {text.tabs.map((item) => {
                const Icon = tabIcons[item.id];
                const count = counts[item.id];
                return (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className={cx("group h-10 gap-2 rounded-full border border-transparent px-4 text-[15px] font-bold text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground data-[state=active]:border-white data-[state=active]:text-foreground data-[state=active]:shadow-[0_6px_18px_rgb(24_40_120/0.08)]", tabTones[item.id].active)}
                  >
                    <Icon aria-hidden="true" className={cx("size-[18px]", tabTones[item.id].icon)} />
                    {item.label}
                    {count === "dot" && <span className="size-2.5 rounded-full bg-destructive" aria-label={text.tabCounts.debt} />}
                    {typeof count === "number" && count > 0 && (
                      <span className="min-w-5 rounded-full bg-white/80 px-1.5 py-0.5 text-center text-[11px] leading-none font-extrabold text-muted-foreground tabular-nums group-data-[state=active]:text-foreground">
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          <div className={cx("relative w-full shrink-0 px-5 pt-2 pb-6 sm:px-6", tab === "overview" && styles.content)}>
            <TabsContent value="overview">
              <OverviewTab student={student} today={today} onOpenLesson={actions.onOpenLesson} />
            </TabsContent>
            <TabsContent value="lessons">
              <LessonsTab student={student} onOpenLesson={actions.onOpenLesson} onAddLesson={() => actions.onLesson({ studentId: student.id })} />
            </TabsContent>
            <TabsContent value="tasks">
              <TasksTab student={student} today={today} />
            </TabsContent>
            <TabsContent value="materials">
              <MaterialsTab student={student} onSend={actions.onMaterial} />
            </TabsContent>
            <TabsContent value="payments">
              <PaymentsTab student={student} onAdd={actions.onPayment} />
            </TabsContent>
            <TabsContent value="notes">
              <NotesTab student={student} />
            </TabsContent>
          </div>
        </Tabs>
        {tab !== "overview" && !focusedTab && !recordTab && <aside className="hidden border-l border-border/60 p-4 lg:block lg:overflow-y-auto">
          <ProfileSummary student={student} today={today} onAssignSchedule={() => actions.onLesson({ studentId: student.id, repeatWeekly: true })} />
        </aside>}
      </div>
    </>
  );
}

/** Карточка ученика с кратким обзором и существующими разделами (STUDENT-OVERVIEW-1). */
export function StudentProfile({ student, onClose, onCloseAutoFocus }: Props) {
  const { notify } = useNotifier();
  const [newLesson, setNewLesson] = useState<NewLessonSeed | null>(null);
  const [paymentFor, setPaymentFor] = useState<Student | null>(null);
  const [materialFor, setMaterialFor] = useState<Student | null>(null);
  const [taskFor, setTaskFor] = useState<Student | null>(null);
  const [removing, setRemoving] = useState<Student | null>(null);
  const [lesson, setLesson] = useState<ScheduleLesson | null>(null);

  const confirmRemove = (target: Student) => {
    removeStudent(target.id);
    setRemoving(null);
    onClose();
    notify(sheet.remove.done(target.name));
  };

  return (
    <>
      <Dialog open={student !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={false}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cx(styles.dialog, "top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:top-4 sm:left-4 sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-none sm:rounded-2xl sm:border")}
        >
          {student && (
            <Profile
              key={student.id}
              student={student}
              actions={{
                onLesson: setNewLesson,
                onPayment: () => setPaymentFor(student),
                onMaterial: () => setMaterialFor(student),
                onTask: () => setTaskFor(student),
                onRemove: () => setRemoving(student),
                onOpenLesson: setLesson,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* «+ Урок» открывает ту же панель, что в расписании, с этим учеником (SCHEDULE-1). */}
      <NewLessonSheet seed={newLesson} onClose={() => setNewLesson(null)} />
      <PaymentDialog student={paymentFor} onClose={() => setPaymentFor(null)} />
      <MaterialDialog student={materialFor} onClose={() => setMaterialFor(null)} />
      {/* «+ Задание» — выбор из «Моих заданий» и выдача сразу этому ученику (TASKS-6). */}
      <AssignWorkDialog open={taskFor !== null} studentId={taskFor?.id} onClose={() => setTaskFor(null)} />
      <RemoveStudentDialog student={removing} onCancel={() => setRemoving(null)} onConfirm={confirmRemove} />
      <LessonSheet lesson={lesson} onClose={() => setLesson(null)} />
    </>
  );
}
