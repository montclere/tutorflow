import { useSyncExternalStore } from "react";
import { navigate, useSearch } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import { parseDateParam, parseView, type ScheduleView } from "../../model/scheduleRange";

const PHONE_QUERY = "(max-width: 520px)";

function subscribePhone(listener: () => void) {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function useIsPhone() {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches);
}

export function scheduleHref(view: ScheduleView, date: string, today: string): string {
  const query = new URLSearchParams();
  query.set("view", view);
  if (date !== today) query.set("date", date);
  return `${teacherRoutes.schedule}?${query.toString()}`;
}

export function useScheduleUrl(today: string) {
  const search = useSearch();
  const isPhone = useIsPhone();
  const params = new URLSearchParams(search);
  const view = parseView(params.get("view"), isPhone ? "list" : "week");
  const date = parseDateParam(params.get("date"), today);

  const go = (next: { view?: ScheduleView; date?: string }) => {
    navigate(scheduleHref(next.view ?? view, next.date ?? date, today), { scroll: false });
  };

  return { view, date, go };
}
