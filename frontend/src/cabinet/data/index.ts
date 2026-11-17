import { students } from "../mocks/people";
import { exam, homework, progress, studentHome, trainer } from "../mocks/student";
import { taskLab } from "../mocks/tasks";
import { finance, review, schedule, teacherOverview } from "../mocks/teacher";
import type {
  ExamData,
  Finance,
  Homework,
  Progress,
  Review,
  Schedule,
  Student,
  StudentHome,
  TaskLab,
  TeacherOverview,
  TrainerData,
} from "../mocks/types";

export function getTeacherOverview(): TeacherOverview {
  return teacherOverview;
}

export function getSchedule(): Schedule {
  return schedule;
}

export function getStudents(): Student[] {
  return students;
}

export function getStudent(id: string): Student {
  const student = students.find((item) => item.id === id);
  if (!student) throw new Error(`Нет ученика ${id}`);
  return student;
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
