import { useSyncExternalStore } from "react";
import { getSchedule, subscribeSchedule } from "./index";

/** Расписание с подпиской: экран перерисуется, когда добавят уроки. */
export function useSchedule() {
  return useSyncExternalStore(subscribeSchedule, getSchedule);
}
