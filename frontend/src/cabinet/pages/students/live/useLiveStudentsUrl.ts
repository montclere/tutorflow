import { navigate, useSearch } from "../../../../app/router";
import { teacherRoutes } from "../../../../config/routes";

export type LiveTab = "active" | "archived" | "invitations";

const tabs: LiveTab[] = ["active", "archived", "invitations"];

export function liveStudentsHref(tab: LiveTab, studentId?: string | null): string {
  const query = new URLSearchParams({ status: tab });
  if (studentId) query.set("student", studentId);
  return `${teacherRoutes.students}?${query.toString()}`;
}

/** Вкладка и открытая карточка — в адресе: их можно обновить, переслать и вернуться назад. */
export function useLiveStudentsUrl() {
  const params = new URLSearchParams(useSearch());
  const tabParam = params.get("status");
  const tab = tabs.find((item) => item === tabParam) ?? "active";
  const studentId = params.get("student");

  const go = (next: { tab?: LiveTab; studentId?: string | null }) => {
    const nextTab = next.tab ?? tab;
    const nextStudent = next.studentId === undefined ? (next.tab ? null : studentId) : next.studentId;
    navigate(liveStudentsHref(nextTab, nextStudent), { scroll: false });
  };

  return { tab, studentId, go };
}
