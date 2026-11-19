import { env } from "../../config/env";
import { cabinet } from "../content/cabinet.ru";
import { EmptyState } from "../ui/EmptyState";

const text = cabinet.soon;

type Section = "finance" | "tasks" | "review" | "student";

/** Раздел без маршрутов API в рабочей сборке — честное «скоро» вместо тестовых данных. */
export function SoonPage({ section }: { section: Section }) {
  return <EmptyState emoji="🚧" title={text.title} text={`${text[section]}${env.demoUrl ? ` ${text.demo}` : ""}`} />;
}
