import { cabinet } from "../content/cabinet.ru";
import { addDays, formatLongDay, weekDates, weekdayIndex } from "../model/dates";
import { upcomingFreeWindows } from "../model/freeSlots";
import { expandTemplates, lessonsOn } from "../model/lessons";
import { toLessonRow, weekDays } from "../model/overview";
import { students } from "../mocks/people";
import { studentDetails } from "../mocks/studentDetails";
import { deriveSchedule, nextLessonOf } from "../model/students";
import { lessonTemplates, scheduleNow, scheduleRange, scheduleToday, singleLessons, workHours } from "../mocks/schedule";
import { exam, homework, progress, studentHome, trainer } from "../mocks/student";
import { taskLab } from "../mocks/tasks";
import { finance, overviewBase, review } from "../mocks/teacher";
import type {
  ExamData,
  Finance,
  Homework,
  Progress,
  Review,
  ScheduleData,
  ExamPrep,
  Student,
  StudentDetails,
  StudentHome,
  TaskLab,
  TeacherOverview,
  TrainerData,
} from "../mocks/types";

const schedule: ScheduleData = {
  today: scheduleToday,
  now: scheduleNow,
  work: workHours,
  lessons: [...expandTemplates(lessonTemplates, scheduleRange.from, scheduleRange.to), ...singleLessons],
};

export function getSchedule(): ScheduleData {
  return schedule;
}

const allStudents: Student[] = students.map((record) => ({
  ...record,
  schedule: deriveSchedule(record.id, lessonTemplates, cabinet.weekdays, cabinet.teacher.students.mixedTime),
  nextLesson: nextLessonOf(record.id, schedule.lessons, schedule.today, schedule.now),
}));

export function getStudents(): Student[] {
  return allStudents;
}

const emptyDetails: StudentDetails = { payments: [], tasks: [], trainer: null, notes: [] };

export function getStudentDetails(id: string): StudentDetails {
  return studentDetails[id] ?? emptyDetails;
}

export function getStudent(id: string): Student {
  const student = allStudents.find((item) => item.id === id);
  if (!student) throw new Error(`Нет ученика ${id}`);
  return student;
}

function examPreps(): ExamPrep[] {
  return allStudents.flatMap((student) => {
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
      freeWindows: windows.map(({ date, window }) => `${cabinet.weekdays[weekdayIndex(date)]} ${window.start}–${window.end}`),
    },
    exams: examPreps(),
  };
}

export function getTaskLab(): TaskLab {
  return taskLab;
}

export function getReview(): Review {
  return review;
}

export function getFinance(): Finance {
  return finance;
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
