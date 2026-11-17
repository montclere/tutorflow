import { navigate, useSearch } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import type { StudentStatus } from "../../mocks/types";

const statuses: StudentStatus[] = ["active", "pause", "archive"];

export function studentsHref(status: StudentStatus, studentId?: string | null): string {
  const query = new URLSearchParams({ status });
  if (studentId) query.set("student", studentId);
  return `${teacherRoutes.students}?${query.toString()}`;
}

export function useStudentsUrl() {
  const params = new URLSearchParams(useSearch());
  const statusParam = params.get("status");
  const status = statuses.find((item) => item === statusParam) ?? "active";
  const studentId = params.get("student");

  const go = (next: { status?: StudentStatus; studentId?: string | null }) => {
    const nextStatus = next.status ?? status;
    const nextStudent = next.studentId === undefined ? (next.status ? null : studentId) : next.studentId;
    navigate(studentsHref(nextStatus, nextStudent), { scroll: false });
  };

  return { status, studentId, go };
}
