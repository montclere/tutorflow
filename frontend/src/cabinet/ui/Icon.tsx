import {
  Zap,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  BookOpen,
  Flag,
  House,
  ListChecks,
  Package,
  UserX,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { AttentionKind } from "../mocks/types";
import type { IconName } from "../content/cabinet.ru";

const navIcons: Record<IconName, LucideIcon> = {
  home: House,
  calendar: CalendarDays,
  users: Users,
  tasks: ClipboardList,
  check: ListChecks,
  money: Wallet,
  bolt: Zap,
  flag: Flag,
  chart: ChartColumn,
  book: BookOpen,
};

const attentionIcons: Record<AttentionKind, LucideIcon> = {
  lesson: Clock,
  review: ClipboardCheck,
  debt: CreditCard,
  package: Package,
  inactive: UserX,
};

export const ICON_SIZE = 18;

export function NavIcon({ name }: { name: IconName }) {
  const Component = navIcons[name];
  return <Component size={ICON_SIZE} aria-hidden="true" />;
}

export function AttentionIcon({ kind }: { kind: AttentionKind }) {
  const Component = attentionIcons[kind];
  return <Component size={ICON_SIZE} aria-hidden="true" />;
}

