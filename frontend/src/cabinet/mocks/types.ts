export type PaymentStatus = "paid" | "debt" | "low";
export type Tone = "blue" | "lime" | "ok" | "bad" | "warn" | "grey";
export type StudentColor = "peach" | "mint" | "rose" | "sky" | "lilac" | "teal";
export type RichPart = string | { sup: string } | { sub: string };
export type Rich = RichPart[];

export type StudentStatus = "active" | "pause" | "archive";
export type StudentSource = "Знакомые" | "Авито" | "Профи.ру" | "Сайт" | "Другое";
export type PaymentModel = "per_lesson" | "package";

export type NextLesson = { date: string; start: string };

export type RecentLesson = {
  date: string;
  topic: string;
  status: "done" | "cancelled" | "moved";
  homework: { title: string; done: number | null; total: number } | null;
};

export type Student = {
  id: string;
  name: string;
  initials: string;
  color: StudentColor;
  goal: string;
  status: StudentStatus;
  schedule: { timesPerWeek: number; days: string[]; time: string; durationMin: number };
  payment: {
    model: PaymentModel;
    pricePerLesson: number;
    package?: { lessons: number; price: number; left: number };
  };
  balance: number;
  nextLesson: NextLesson | null;
  lessonsCount: number;
  startedAt: string;
  telegramConnected: boolean;
  parent?: { name: string; relation: string; phone: string };
  source: StudentSource;
  exam?: { daysLeft: number; readiness: number; weak: number[] };
  recentLessons: RecentLesson[];
  note: string;
};

export type StudentRecord = Omit<Student, "schedule" | "nextLesson">;

export type PaymentMove = { date: string; title: string; amount: number };
export type TaskMistake = { number: string; topic: string; answer: string; correct: string };
export type TaskScore = { correct: number; total: number };
export type AssignedTask = {
  title: string;
  status: "todo" | "wait" | "done";
  assignedAt: string;
  due?: string;
  submittedAt?: string;
  timeMin?: number;
  score: TaskScore | null;
  mistakes: TaskMistake[];
};
export type StudentNote = { date: string; text: string };

export type MaterialKind = "pdf" | "doc" | "slides" | "image" | "link" | "other";

/** Материал для ученика: файл теории, конспект или ссылка. Появляется у ученика в кабинете. */
export type StudentMaterial = {
  id: string;
  title: string;
  kind: MaterialKind;
  fileName?: string;
  sizeBytes?: number;
  /** Адрес файла или ссылки; у тестовых материалов без файла — нет. */
  url?: string;
  note?: string;
  sentAt: string;
  openedAt: string | null;
};

export type StudentDetails = {
  payments: PaymentMove[];
  tasks: AssignedTask[];
  trainer: { solvedWeek: number; accuracy: number; weak: string } | null;
  notes: StudentNote[];
  materials: StudentMaterial[];
};

export type Person = { name: string; initials: string; color: StudentColor; roleLabel: string };

export type StatData = { label: string; value: string; note: string; highlight?: boolean };


export type LessonStatus = "done" | "soon" | "paid" | "debt";

export type LessonRow = {
  id: string;
  time: string;
  studentId: string;
  goal: string;
  status: LessonStatus;
  minutes: number;
  past: boolean;
};

export type AttentionKind = "lesson" | "review" | "debt" | "package" | "inactive";
export type AttentionItem = { kind: AttentionKind; title: string; note: string; studentId?: string };

export type WeekDay = { label: string; date: string; lessons: number; today?: boolean };
export type FreeWindowLink = { date: string; label: string };
export type WeekPlan = { days: WeekDay[]; capacity: number; freeWindows: FreeWindowLink[] };

export type ExamTrend = { studentId: string; delta: number; inactiveDays?: number };

export type OverviewBase = {
  teacherName: string;
  attention: AttentionItem[];
  weekCapacity: number;
  examTrends: ExamTrend[];
};

export type ExamPrep = {
  studentId: string;
  exam: string;
  daysLeft: number;
  weakNumber?: number;
  inactiveDays?: number;
  readiness: number;
  delta: number;
};

export type TeacherOverview = {
  teacherName: string;
  date: string;
  today: LessonRow[];
  tomorrow: LessonRow[];
  attention: AttentionItem[];
  week: WeekPlan;
  exams: ExamPrep[];
};

export type OperationKind = "payment" | "lesson" | "correction";
export type PaymentMethod = "sbp" | "cash" | "transfer";

export type FinanceOperation = {
  id: string;
  date: string;
  studentId: string;
  kind: OperationKind;
  title: string;
  method: PaymentMethod | null;
  amount: number;
};

export type MonthStat = { month: string; received: number; payments: number; lessons: number };

export type FinanceMock = { history: MonthStat[]; operations: FinanceOperation[]; debtDays: Record<string, number> };

export type DebtorRow = { studentId: string; amount: number; days: number; payer: string | null };
export type PackageRow = { studentId: string; left: number; total: number; ending: boolean };

export type FinanceOverview = {
  month: string;
  months: string[];
  history: MonthStat[];
  stat: MonthStat | null;
  receivedGrowth: number | null;
  expected: { amount: number; lessons: number };
  debt: { amount: number; count: number };
  prepaid: { amount: number; lessons: number };
  debtors: DebtorRow[];
  packages: PackageRow[];
  operations: FinanceOperation[];
};

export type ExamData = {
  title: string;
  subtitle: string;
  parts: { title: string; note: string }[];
  history: { title: string; date: string; score: string; tone: Tone }[];
  durationSeconds: number;
  taskCount: number;
  current: { number: number; question: Rich; points: number };
};


export type LessonType = "individual" | "group" | "trial";

export type LessonTemplate = {
  id: string;
  studentId: string;
  weekday: number;
  start: string;
  durationMin: number;
  type: Exclude<LessonType, "trial">;
  groupTitle?: string;
};

/** Состояние урока по API lessons; у тестовых уроков его нет — они считаются запланированными. */
export type LessonOutcome = "scheduled" | "completed" | "no_show" | "cancelled";

export type ScheduleLesson = {
  id: string;
  studentId: string;
  date: string;
  start: string;
  durationMin: number;
  type: LessonType;
  recurring: boolean;
  groupTitle?: string;
  link?: string;
  status?: LessonOutcome;
};

export type WorkHours = { start: string; end: string; minFreeWindowMin: number };
export type ScheduleData = { today: string; now: string; work: WorkHours; lessons: ScheduleLesson[] };
