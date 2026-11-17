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

export type StudentDetails = {
  payments: PaymentMove[];
  tasks: AssignedTask[];
  trainer: { solvedWeek: number; accuracy: number; weak: string } | null;
  notes: StudentNote[];
};

export type Person = { name: string; initials: string; color: StudentColor; roleLabel: string };

export type StatData = { label: string; value: string; note: string; highlight?: boolean };

export type TaskStatus = { title: string; note: string; tone: Tone; status: string };

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
export type AttentionItem = { kind: AttentionKind; title: string; note: string };

export type WeekDay = { label: string; lessons: number; today?: boolean };
export type WeekPlan = { days: WeekDay[]; capacity: number; freeWindows: string[] };

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

export type ChatMessage = { author: "me" | "ai"; text: string };
export type ParamField = { label: string; options: string[] };
export type DraftCard = { badge: string; source: string; question: Rich; answer: string };
export type TaskDraft = { title: string; subtitle: string; cards: DraftCard[]; hiddenCards: number };
export type ExamNumber = { number: number; topic: string; count: number };
export type Prototype = { label: string; question: Rich; source: string };
export type MyTask = { title: string; cards: number; assigned: string; average: string };

export type TaskLab = {
  params: ParamField[];
  messages: ChatMessage[];
  quickReplies: string[];
  draft: TaskDraft;
  exams: string[];
  numbers: ExamNumber[];
  prototypes: Prototype[];
  mine: MyTask[];
  aiReply: (request: string) => string;
};

export type ReviewItem = { studentId: string; title: string; when: string; aiScore: string; note: string };
export type ReviewSolution = { lines: string[]; mistake: string };
export type Review = { queue: ReviewItem[]; solution: ReviewSolution };

export type StudentHome = {
  greeting: string;
  subtitle: string;
  stats: StatData[];
  homework: TaskStatus[];
  weak: { number: number; topic: string; percent: number }[];
  feedback: { title: string; text: string };
};

export type HomeworkCard = { title: string; subtitle: string; deadline: string; tone: Tone; status: string };
export type DoneHomework = {
  title: string;
  checkedOn: string;
  score: string;
  results: { ok: boolean; title: string; note: string }[];
};
export type Homework = {
  todo: HomeworkCard[];
  waiting: { title: string; note: string; status: string };
  done: DoneHomework;
};

export type Drill = { number: number; question: Rich; answer: string; hint: string; solution: string };
export type TrainerData = { drills: Drill[]; streak: number; solved: number; dailyGoal: number; numbers: ExamNumber[] };

export type ExamData = {
  title: string;
  subtitle: string;
  parts: { title: string; note: string }[];
  history: { title: string; date: string; score: string; tone: Tone }[];
  durationSeconds: number;
  taskCount: number;
  current: { number: number; question: Rich; points: number };
};

export type Progress = { stats: StatData[]; levels: number[] };

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

export type ScheduleLesson = {
  id: string;
  studentId: string;
  date: string;
  start: string;
  durationMin: number;
  type: LessonType;
  recurring: boolean;
  groupTitle?: string;
};

export type WorkHours = { start: string; end: string; minFreeWindowMin: number };
export type ScheduleData = { today: string; now: string; work: WorkHours; lessons: ScheduleLesson[] };
