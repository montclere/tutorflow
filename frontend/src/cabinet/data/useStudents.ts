import { useSyncExternalStore } from "react";
import { getStudents, subscribeStudents } from "./index";

/** Ученики с подпиской: список перерисуется после добавления, оплаты, смены статуса или новых уроков. */
export function useStudents() {
  return useSyncExternalStore(subscribeStudents, getStudents);
}
