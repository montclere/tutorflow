import { Ellipsis, Plus } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { removeStudent, setStudentStatus } from "../../data";
import type { ScheduleLesson, Student, StudentStatus } from "../../mocks/types";
import { formatDayMonth } from "../../model/dates";
import { formatRubles } from "../../model/format";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/kit/dropdown-menu";
import { ScrollArea } from "@/shared/ui/kit/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/shared/ui/kit/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/kit/tabs";
import { LessonSheet } from "../schedule/LessonSheet";
import { NewLessonSheet, type NewLessonSeed } from "../schedule/NewLessonSheet";
import { PaymentDialog } from "./PaymentDialog";
import { RemoveStudentDialog } from "./RemoveStudentDialog";
import { StudentOverview } from "./StudentOverview";
import { TasksTab } from "./StudentTasks";
import { LessonsTab, NotesTab, PaymentsTab } from "./StudentTabs";
import { balanceClass, formatBalance, nextLessonText } from "./StudentsTable";

const students = cabinet.teacher.students;
const text = students.sheet;

type Props = {
  student: Student | null;
  today: string;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
};

function Tile({ label, value, note, valueClass }: { label: string; value: string; note?: string; valueClass?: string }) {
  return (
    <div className="grid min-w-0 content-start gap-1 rounded-2xl border bg-card p-4">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      <b className={cx("font-[family-name:var(--font-display)] text-lg leading-snug font-extrabold tabular-nums", valueClass)}>{value}</b>
      {note && <span className="text-sm font-semibold text-muted-foreground tabular-nums">{note}</span>}
    </div>
  );
}

function tariff(student: Student): { value: string; note?: string } {
  const { model, pricePerLesson, package: pack } = student.payment;
  if (model === "package" && pack) {
    return { value: students.payment.package, note: text.tariff.package(pack.left, pack.lessons) };
  }
  return { value: students.payment.perLesson, note: students.payment.pricePerLesson(formatRubles(pricePerLesson)) };
}

export function StudentSheet({ student, today, onClose, onCloseAutoFocus }: Props) {
  const { notify, notifySoon } = useNotifier();
  const [tab, setTab] = useState("overview");
  const [newLesson, setNewLesson] = useState<NewLessonSeed | null>(null);
  const [paymentFor, setPaymentFor] = useState<Student | null>(null);
  const [removing, setRemoving] = useState<Student | null>(null);
  const [lesson, setLesson] = useState<ScheduleLesson | null>(null);

  const moveTo = (target: Student, status: StudentStatus) => {
    setStudentStatus(target.id, status);
    notify(text.statusDone[status](target.name));
  };

  const confirmRemove = (target: Student) => {
    removeStudent(target.id);
    setRemoving(null);
    onClose();
    notify(text.remove.done(target.name));
  };

  return (
    <>
      <Sheet open={student !== null} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-[640px]" onCloseAutoFocus={onCloseAutoFocus}>
          {student && (
            <ScrollArea className="min-h-0 flex-1">
              <div className="grid grid-cols-[minmax(0,1fr)] gap-5 p-5 sm:p-6">
                <div className="flex items-center gap-4 pr-10">
                  <Avatar initials={student.initials} color={student.color} large />
                  <div className="min-w-0">
                    <SheetTitle className="m-0 font-[family-name:var(--font-display)] text-2xl leading-tight font-black tracking-tight">{student.name}</SheetTitle>
                    <SheetDescription className="m-0 text-base font-semibold">{text.since(student.goal, formatDayMonth(student.startedAt))}</SheetDescription>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" icon={Plus} onClick={() => setNewLesson({ studentId: student.id })}>
                    {text.actions.lesson}
                  </Button>
                  <Button icon={Plus} onClick={() => setPaymentFor(student)}>
                    {text.actions.payment}
                  </Button>
                  <Button icon={Plus} onClick={() => notifySoon(text.actions.task)}>
                    {text.actions.task}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button icon={Ellipsis}>{text.actions.more}</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* Пункты зависят от текущего статуса (STUDENTS-4). */}
                      {student.status !== "active" && <DropdownMenuItem onSelect={() => moveTo(student, "active")}>{text.moreItems.restore}</DropdownMenuItem>}
                      {student.status === "active" && <DropdownMenuItem onSelect={() => moveTo(student, "pause")}>{text.moreItems.pause}</DropdownMenuItem>}
                      {student.status !== "archive" && <DropdownMenuItem onSelect={() => moveTo(student, "archive")}>{text.moreItems.archive}</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(student)}>
                        {text.moreItems.remove}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Tile label={text.tiles.balance} value={formatBalance(student.balance)} valueClass={balanceClass(student.balance)} />
                  <Tile label={text.tiles.next} value={nextLessonText(student, today)} />
                  <Tile label={text.tiles.tariff} {...tariff(student)} />
                  <Tile label={text.tiles.done} value={String(student.lessonsCount)} />
                </div>

                <Tabs key={student.id} value={tab} onValueChange={setTab} className="gap-4">
                  <TabsList aria-label={text.tabsLabel}>
                    {text.tabs.map((item) => (
                      <TabsTrigger key={item.id} value={item.id}>
                        {item.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value="overview">
                    <StudentOverview student={student} onOpenLesson={setLesson} onAssignSchedule={() => setNewLesson({ studentId: student.id, repeatWeekly: true })} />
                  </TabsContent>
                  <TabsContent value="lessons">
                    <LessonsTab student={student} onOpenLesson={setLesson} />
                  </TabsContent>
                  <TabsContent value="payments">
                    <PaymentsTab student={student} />
                  </TabsContent>
                  <TabsContent value="tasks">
                    <TasksTab student={student} />
                  </TabsContent>
                  <TabsContent value="notes">
                    <NotesTab student={student} />
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
      {/* «+ Урок» открывает ту же панель, что в расписании, с этим учеником (SCHEDULE-1). */}
      <NewLessonSheet seed={newLesson} onClose={() => setNewLesson(null)} />
      <PaymentDialog student={paymentFor} onClose={() => setPaymentFor(null)} />
      <RemoveStudentDialog student={removing} onCancel={() => setRemoving(null)} onConfirm={confirmRemove} />
      <LessonSheet lesson={lesson} onClose={() => setLesson(null)} />
    </>
  );
}
