import { navigate, useSearch } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";

export function useFinanceUrl(months: string[], current: string) {
  const requested = new URLSearchParams(useSearch()).get("month");
  const month = requested && months.includes(requested) ? requested : current;

  const go = (next: string) => navigate(`${teacherRoutes.finance}?month=${next}`, { scroll: false });

  return { month, go };
}
