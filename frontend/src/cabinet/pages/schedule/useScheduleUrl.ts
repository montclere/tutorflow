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

export function useScheduleUrl(today: string) {
  const search = useSearch();
  const isPhone = useIsPhone();
  const params = new URLSearchParams(search);
  const view = parseView(params.get("view"), isPhone ? "list" : "week");
  const date = parseDateParam(params.get("date"), today);

  const go = (next: { view?: ScheduleView; date?: string }) => {
    const query = new URLSearchParams();
    query.set("view", next.view ?? view);
    const nextDate = next.date ?? date;
    if (nextDate !== today) query.set("date", nextDate);
    navigate(`${teacherRoutes.schedule}?${query.toString()}`, { scroll: false });
  };

  return { view, date, go };
}
