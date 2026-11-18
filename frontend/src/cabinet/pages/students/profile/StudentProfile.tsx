import { Ellipsis, MessageCircle, Plus, Upload, X } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../../content/cabinet.ru";
import { getSchedule, removeStudent, setStudentStatus } from "../../../data";
import type { ScheduleLesson, Student, StudentStatus } from "../../../mocks/types";
import { formatDayMonth } from "../../../model/dates";
import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";
import { useNotifier } from "../../../ui/Notifications";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/kit/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/kit/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/kit/tabs";
import { LessonSheet } from "../../schedule/LessonSheet";
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

const sheet = cabinet.teacher.students.sheet;
const text = cabinet.teacher.students.profile;

const statusTone: Record<StudentStatus, string> = {
  active: "bg-[var(--cab-ok-soft)] text-success",
  pause: "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]",
  archive: "bg-secondary text-muted-foreground",
};

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", className)}>{children}</span>;
}

type Props = { student: Student | null; onClose: () => void; onCloseAutoFocus: (event: Event) => void };

type Actions = {
  onLesson: (seed: NewLessonSeed) => void;
  onPayment: () => void;
  onMaterial: () => void;
  onRemove: () => void;
  onOpenLesson: (lesson: ScheduleLesson) => void;
};

function Profile({ student, actions }: { student: Student; actions: Actions }) {
  const { notify, notifySoon } = useNotifier();
  const [tab, setTab] = useState<ProfileTab>("overview");
  const { today } = getSchedule();

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
              {student.goal} · {text.since(formatDayMonth(student.startedAt))}
            </DialogDescription>
            <div className="flex flex-wrap gap-1.5">
              <Chip className={statusTone[student.status]}>{text.status[student.status]}</Chip>
              <Chip className={student.telegramConnected ? "bg-accent text-accent-foreground" : "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]"}>
                <MessageCircle size={12} aria-hidden="true" />
                {student.telegramConnected ? text.telegram.on : text.telegram.off}
              </Chip>
            </div>
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
          <Button icon={Plus} onClick={() => notifySoon(text.actions.task)}>
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

      {/* На широком экране сводка и разделы прокручиваются отдельно. */}
      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="hidden border-r bg-secondary/40 p-6 lg:block lg:overflow-y-auto">
          <ProfileSummary student={student} today={today} onAssignSchedule={() => actions.onLesson({ studentId: student.id, repeatWeekly: true })} />
        </aside>
        <Tabs value={tab} onValueChange={(value) => setTab(value as ProfileTab)} className="min-w-0 gap-0 lg:overflow-y-auto">
          <div className="sticky top-0 z-10 shrink-0 overflow-x-auto border-b bg-background/95 px-5 py-3 backdrop-blur sm:px-6">
            <TabsList aria-label={sheet.tabsLabel}>
              {text.tabs.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="mx-auto w-full max-w-[1100px] shrink-0 p-5 sm:p-6">
            <TabsContent value="overview" className="grid grid-cols-[minmax(0,1fr)] gap-4">
              {/* На узком экране сводка — в начале обзора, а вкладки сразу под шапкой. */}
              <div className="rounded-2xl border bg-card p-5 lg:hidden">
                <ProfileSummary student={student} today={today} onAssignSchedule={() => actions.onLesson({ studentId: student.id, repeatWeekly: true })} />
              </div>
              <OverviewTab student={student} today={today} onOpenLesson={actions.onOpenLesson} onTab={setTab} />
            </TabsContent>
            <TabsContent value="lessons">
              <LessonsTab student={student} onOpenLesson={actions.onOpenLesson} />
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
      </div>
    </>
  );
}

/** Карточка ученика на весь экран: сводка слева, разделы справа (STUDENTS-13). */
export function StudentProfile({ student, onClose, onCloseAutoFocus }: Props) {
  const { notify } = useNotifier();
  const [newLesson, setNewLesson] = useState<NewLessonSeed | null>(null);
  const [paymentFor, setPaymentFor] = useState<Student | null>(null);
  const [materialFor, setMaterialFor] = useState<Student | null>(null);
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
          className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:top-4 sm:left-4 sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-none sm:rounded-2xl sm:border"
        >
          {student && (
            <Profile
              key={student.id}
              student={student}
              actions={{
                onLesson: setNewLesson,
                onPayment: () => setPaymentFor(student),
                onMaterial: () => setMaterialFor(student),
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
      <RemoveStudentDialog student={removing} onCancel={() => setRemoving(null)} onConfirm={confirmRemove} />
      <LessonSheet lesson={lesson} onClose={() => setLesson(null)} />
    </>
  );
}
