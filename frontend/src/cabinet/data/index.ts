import { cabinet } from "../content/cabinet.ru";
import { addDays, formatLongDay, weekDates, weekdayIndex } from "../model/dates";
import { upcomingFreeWindows } from "../model/freeSlots";
import { expandTemplates, isPast, lessonsOn } from "../model/lessons";
import { toLessonRow, weekDays } from "../model/overview";
import { withSubjectParam } from "../model/taskParams";
import { students, teacherSubjects } from "../mocks/people";
import { studentDetails } from "../mocks/studentDetails";
import { expectedIncome, growthPercent, lessonsAhead, monthKeyOf, shiftMonth } from "../model/finance";
import { deriveSchedule, LOW_PACKAGE_LEFT, nextLessonOf, templatesFromLessons } from "../model/students";
import { lessonTemplates, scheduleNow, scheduleRange, scheduleToday, singleLessons, workHours } from "../mocks/schedule";
import { exam, homework, progress, studentHome, trainer } from "../mocks/student";
import { taskLab } from "../mocks/tasks";
import { finance, financeToday } from "../mocks/finance";
import { overviewBase, review } from "../mocks/teacher";
import type {
  ExamData,
  FinanceOverview,
  Homework,
  Progress,
  Review,
  ScheduleData,
  PaymentMove,
  ScheduleLesson,
  StudentNote,
  StudentMaterial,
  StudentRecord,
  StudentStatus,
  ExamPrep,
  Student,
  StudentDetails,
  StudentHome,
  TaskLab,
  TeacherOverview,
  TrainerData,
} from "../mocks/types";

// Тестовые данные расписания. Это хранилище в памяти вместо сервера: созданные уроки живут до перезагрузки (SCHEDULE-3).
let schedule: ScheduleData = {
  today: scheduleToday,
  now: scheduleNow,
  work: workHours,
  lessons: [...expandTemplates(lessonTemplates, scheduleRange.from, scheduleRange.to), ...singleLessons],
};
const scheduleListeners = new Set<() => void>();

export function subscribeSchedule(listener: () => void): () => void {
  scheduleListeners.add(listener);
  return () => scheduleListeners.delete(listener);
}

export function addLessons(lessons: ScheduleLesson[]): void {
  if (lessons.length === 0) return;
  schedule = { ...schedule, lessons: [...schedule.lessons, ...lessons] };
  for (const listener of scheduleListeners) listener();
}

/** Будущие уроки удалённого ученика убираем из расписания; прошлые остаются в истории. */
function removeFutureLessonsOf(studentId: string): void {
  schedule = { ...schedule, lessons: schedule.lessons.filter((lesson) => lesson.studentId !== studentId || isPast(lesson, schedule.today, schedule.now)) };
  for (const listener of scheduleListeners) listener();
}

export function getSchedule(): ScheduleData {
  return schedule;
}

// Ученики — тоже хранилище в памяти вместо сервера (STUDENTS-6). Удалённые остаются в записях с пометкой removed:
// на них ссылаются прошлые уроки и операции, а из списков они исчезают.
let studentRecords: (StudentRecord & { removed?: boolean })[] = [...students];
type AddedDetails = { payments: PaymentMove[]; notes: StudentNote[]; materials: StudentMaterial[] };
const addedDetails: Record<string, AddedDetails> = {};
const removedMaterials = new Set<string>();
const openedMaterials = new Map<string, string>();
const addedOf = (id: string): AddedDetails => (addedDetails[id] ??= { payments: [], notes: [], materials: [] });
let studentsVersion = 0;
const studentListeners = new Set<() => void>();
let studentsCache: { version: number; schedule: ScheduleData; all: Student[]; visible: Student[] } | null = null;

function emitStudents(): void {
  studentsVersion += 1;
  for (const listener of studentListeners) listener();
}

/** Подписка и на учеников, и на расписание: «следующий урок» зависит от обоих. */
export function subscribeStudents(listener: () => void): () => void {
  studentListeners.add(listener);
  const unsubscribeSchedule = subscribeSchedule(listener);
  return () => {
    studentListeners.delete(listener);
    unsubscribeSchedule();
  };
}

function studentsSnapshot() {
  if (studentsCache && studentsCache.version === studentsVersion && studentsCache.schedule === schedule) return studentsCache;
  const all = studentRecords.map((record) => ({
    ...record,
    schedule: deriveSchedule(record.id, templatesFromLessons(record.id, schedule.lessons, schedule.today), cabinet.weekdays, cabinet.teacher.students.mixedTime),
    nextLesson: nextLessonOf(record.id, schedule.lessons, schedule.today, schedule.now),
  }));
  studentsCache = { version: studentsVersion, schedule, all, visible: all.filter((student) => !studentRecords.find((record) => record.id === student.id)?.removed) };
  return studentsCache;
}

export function getStudents(): Student[] {
  return studentsSnapshot().visible;
}

export function addStudent(record: StudentRecord): void {
  studentRecords = [...studentRecords, record];
  emitStudents();
}

export function setStudentStatus(id: string, status: StudentStatus): void {
  studentRecords = studentRecords.map((record) => (record.id === id ? { ...record, status } : record));
  emitStudents();
}

export function removeStudent(id: string): void {
  studentRecords = studentRecords.map((record) => (record.id === id ? { ...record, removed: true } : record));
  removeFutureLessonsOf(id);
  emitStudents();
}

export function addPayment(id: string, move: PaymentMove): void {
  studentRecords = studentRecords.map((record) => (record.id === id ? { ...record, balance: record.balance + move.amount } : record));
  const added = addedOf(id);
  added.payments = [move, ...added.payments];
  emitStudents();
}

export function addNote(id: string, note: StudentNote): void {
  const added = addedOf(id);
  added.notes = [note, ...added.notes];
  emitStudents();
}

/** Материал ученику: в демо — в памяти до перезагрузки, файл — по локальной ссылке браузера. */
export function addMaterials(id: string, materials: StudentMaterial[]): void {
  const added = addedOf(id);
  added.materials = [...materials, ...added.materials];
  emitStudents();
}

export function removeMaterial(materialId: string): void {
  removedMaterials.add(materialId);
  emitStudents();
}

/** Ученик открыл материал — репетитор увидит «Открыт» с датой. */
export function markMaterialOpened(materialId: string, date: string): void {
  if (openedMaterials.has(materialId)) return;
  openedMaterials.set(materialId, date);
  emitStudents();
}

const emptyDetails: StudentDetails = { payments: [], tasks: [], trainer: null, notes: [], materials: [] };

export function getStudentDetails(id: string): StudentDetails {
  const base = studentDetails[id] ?? emptyDetails;
  const added = addedDetails[id];
  const materials = [...(added?.materials ?? []), ...base.materials]
    .filter((material) => !removedMaterials.has(material.id))
    .map((material) => (material.openedAt || !openedMaterials.has(material.id) ? material : { ...material, openedAt: openedMaterials.get(material.id) ?? null }));
  if (!added) return removedMaterials.size === 0 && openedMaterials.size === 0 ? base : { ...base, materials };
  return { ...base, payments: [...added.payments, ...base.payments], notes: [...added.notes, ...base.notes], materials };
}

export function getStudent(id: string): Student {
  const student = studentsSnapshot().all.find((item) => item.id === id);
  if (!student) throw new Error(`Нет ученика ${id}`);
  return student;
}

function examPreps(): ExamPrep[] {
  return getStudents().flatMap((student) => {
    if (student.status !== "active" || !student.exam) return [];
    const trend = overviewBase.examTrends.find((item) => item.studentId === student.id);
    return [
      {
        studentId: student.id,
        exam: student.goal.split(" · ")[0] ?? student.goal,
        daysLeft: student.exam.daysLeft,
        weakNumber: student.exam.weak[0],
        inactiveDays: trend?.inactiveDays,
        readiness: student.exam.readiness,
        delta: trend?.delta ?? 0,
      },
    ];
  });
}

export function getTeacherOverview(): TeacherOverview {
  const { today, now, work, lessons } = schedule;
  const rowsOn = (date: string) => lessonsOn(lessons, date).map((lesson) => toLessonRow(lesson, getStudent(lesson.studentId), today, now));
  const windows = upcomingFreeWindows(lessons, weekDates(today), work, today, now);

  return {
    teacherName: overviewBase.teacherName,
    date: formatLongDay(today),
    today: rowsOn(today),
    tomorrow: rowsOn(addDays(today, 1)),
    attention: overviewBase.attention,
    week: {
      days: weekDays(lessons, today, cabinet.weekdays),
      capacity: overviewBase.weekCapacity,
      freeWindows: windows.map(({ date, window }) => ({ date, label: `${cabinet.weekdays[weekdayIndex(date)]} ${window.start}–${window.end}` })),
    },
    exams: examPreps(),
  };
}

export function getTaskLab(): TaskLab {
  return { ...taskLab, params: withSubjectParam(taskLab.params, teacherSubjects, cabinet.teacher.tasks.subjectLabel) };
}

export function getReview(): Review {
  return review;
}

export function getCurrentMonth(): string {
  return monthKeyOf(financeToday);
}

export function getFinanceMonths(): string[] {
  return finance.history.map((item) => item.month);
}

export function getFinanceOverview(month: string): FinanceOverview {
  const { history, operations, debtDays } = finance;
  const active = getStudents().filter((student) => student.status === "active");
  const stat = history.find((item) => item.month === month) ?? null;
  const previous = history.find((item) => item.month === shiftMonth(month, -1));
  const debtors = active.filter((student) => student.balance < 0);
  const prepaid = active.filter((student) => student.balance > 0);
  const debtAmount = debtors.reduce((sum, student) => sum - student.balance, 0);

  return {
    month,
    months: history.map((item) => item.month),
    history,
    stat,
    receivedGrowth: stat && previous ? growthPercent(stat.received, previous.received) : null,
    expected: expectedIncome(
      schedule.lessons,
      (id) => {
        const { model, pricePerLesson } = getStudent(id).payment;
        return model === "per_lesson" ? pricePerLesson : null;
      },
      month,
      schedule.today,
      schedule.now,
      debtAmount,
    ),
    debt: { amount: debtAmount, count: debtors.length },
    prepaid: {
      amount: prepaid.reduce((sum, student) => sum + student.balance, 0),
      lessons: prepaid.reduce((sum, student) => sum + lessonsAhead(student), 0),
    },
    debtors: debtors.map((student) => ({
      studentId: student.id,
      amount: -student.balance,
      days: debtDays[student.id] ?? 0,
      payer: student.parent ? student.parent.relation.toLowerCase() : null,
    })),
    packages: active.flatMap((student) => {
      const pack = student.payment.package;
      return student.payment.model === "package" && pack ? [{ studentId: student.id, left: pack.left, total: pack.lessons, ending: pack.left <= LOW_PACKAGE_LEFT }] : [];
    }),
    operations: operations.filter((operation) => monthKeyOf(operation.date) === month),
  };
}

export function getStudentHome(): StudentHome {
  return studentHome;
}

export function getHomework(): Homework {
  return homework;
}

export function getTrainer(): TrainerData {
  return trainer;
}

export function getExam(): ExamData {
  return exam;
}

export function getProgress(): Progress {
  return progress;
}
