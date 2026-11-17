export type Tone = "blue" | "lime" | "ok" | "bad" | "warn" | "grey";
export type AvatarTone = "peach" | "mint" | "rose" | "sky" | "lilac";
export type RichPart = string | { sup: string } | { sub: string };
export type Rich = RichPart[];

export type Student = {
  id: string;
  name: string;
  initials: string;
  tone: AvatarTone;
  subject: string;
  balanceKopecks: number;
  lessons: number;
  progress: number;
};

export type Person = { name: string; initials: string; tone: AvatarTone; roleLabel: string };

export type StatData = { label: string; value: string; note: string; highlight?: boolean };

export type TaskStatus = { title: string; note: string; tone: Tone; status: string };

export type LessonRow = {
  time: string;
  studentId: string;
  subject: string;
  statusLabel: string;
  statusTone: Tone;
  past: boolean;
};

export type AttentionKind = "lesson" | "review" | "debt" | "package" | "inactive";
export type AttentionItem = { kind: AttentionKind; title: string; note: string };

export type WeekDay = { label: string; lessons: number; today?: boolean };
export type WeekPlan = { days: WeekDay[]; capacity: number; freeWindows: string[] };

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

export type ScheduleEvent = { day: number; hour: number; studentId: string; tone: "blue" | "ok" | "bad" };
export type Schedule = { range: string; days: string[]; todayIndex: number; hours: string[]; events: ScheduleEvent[] };

export type Operation = { date: string; studentId: string; title: string; amountKopecks: number };
export type Finance = { month: string; stats: StatData[]; operations: Operation[] };

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
