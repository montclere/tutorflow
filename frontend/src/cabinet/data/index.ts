import { cabinet } from "../content/cabinet.ru";
import { addDays, formatLongDay, weekDates, weekdayIndex } from "../model/dates";
import { upcomingFreeWindows } from "../model/freeSlots";
import { expandTemplates, lessonsOn } from "../model/lessons";
import { toLessonRow, weekDays } from "../model/overview";
import { students, teacherSubjects } from "../mocks/people";
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
  Student,
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

export function getStudents(): Student[] {
  return students.filter((student) => student.status === "active");
}

export function getTeacherSubjects(): string[] {
  return teacherSubjects;
}

export function getAllStudents(): Student[] {
  return students;
}

export function getStudent(id: string): Student {
  const student = students.find((item) => item.id === id);
  if (!student) throw new Error(`Нет ученика ${id}`);
  return student;
}

export function getTeacherOverview(): TeacherOverview {
  const { today, now, work, lessons } = schedule;
  const rowsOn = (date: string) => lessonsOn(lessons, date).map((lesson) => toLessonRow(lesson, getStudent(lesson.studentId), today, now));
  const windows = upcomingFreeWindows(lessons, weekDates(today, true), work, today, now);

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
    exams: overviewBase.exams,
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
