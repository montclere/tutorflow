export const routes = {
  home: "/",
  teacherCabinet: "/teacher",
  studentCabinet: "/student",
  offer: "/offer",
  privacy: "/privacy",
} as const;

export const teacherRoutes = {
  overview: "/teacher",
  schedule: "/teacher/schedule",
  students: "/teacher/students",
  tasksCreate: "/teacher/tasks",
  tasksBank: "/teacher/tasks/bank",
  tasksMine: "/teacher/tasks/mine",
  review: "/teacher/review",
  finance: "/teacher/finance",
} as const;

export const studentRoutes = {
  home: "/student",
  tasks: "/student/tasks",
  trainer: "/student/trainer",
  exam: "/student/exam",
  progress: "/student/progress",
} as const;
