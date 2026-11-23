import { BookOpenText, CalendarDots, ChartBar, ClipboardText, Clock, CreditCard, Exam, FlagBanner, House, Lightning, ListChecks, Package, UserMinus, UsersThree, Wallet } from "@phosphor-icons/react";
import type { AppIcon } from "@/shared/ui/icon";
import type { AttentionKind } from "../mocks/types";
import type { IconName } from "../content/cabinet.ru";

const navIcons: Record<IconName, AppIcon> = {
  home: House,
  calendar: CalendarDots,
  users: UsersThree,
  tasks: ClipboardText,
  check: ListChecks,
  money: Wallet,
  bolt: Lightning,
  flag: FlagBanner,
  chart: ChartBar,
  book: BookOpenText,
};

const attentionIcons: Record<AttentionKind, AppIcon> = {
  lesson: Clock,
  review: Exam,
  debt: CreditCard,
  package: Package,
  inactive: UserMinus,
};

export const ICON_SIZE = 20;

export function NavIcon({ name }: { name: IconName }) {
  const Component = navIcons[name];
  return <Component size={ICON_SIZE} aria-hidden="true" />;
}

export function AttentionIcon({ kind }: { kind: AttentionKind }) {
  const Component = attentionIcons[kind];
  return <Component size={ICON_SIZE} aria-hidden="true" />;
}

