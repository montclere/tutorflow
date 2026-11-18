import type { StudentsRange } from "../../features/auth/api/types";

export type SignupMethod = "telegram" | "google" | "email";
export type CtaPlace = "hero" | "final" | "pricing" | "mobile";

type AnalyticsEvents = {
  signup_view: undefined;
  signup_method_click: { method: SignupMethod };
  signup_consent_missing: undefined;
  signup_code_sent: undefined;
  signup_code_error: undefined;
  signup_profile_submit: { subjectsCount: number; studentsRange: StudentsRange | null };
  signup_complete: undefined;
  cta_click: { place: CtaPlace };
};

export type Track = <E extends keyof AnalyticsEvents>(
  event: E,
  ...props: AnalyticsEvents[E] extends undefined ? [] : [AnalyticsEvents[E]]
) => void;

// Системы аналитики в проекте пока нет: интерфейс зафиксирован, отправка не выполняется.
export const track: Track = () => {};
