import type { Role } from "../content/cabinet.ru";

export function roleOfPath(pathname: string): Role {
  return pathname === "/student" || pathname.startsWith("/student/") ? "student" : "teacher";
}
