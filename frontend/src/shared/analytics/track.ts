export type CtaPlace = "hero" | "final" | "pricing" | "mobile";

type AnalyticsEvents = {
  signup_view: undefined;
  signup_consent_missing: undefined;
  signup_code_sent: undefined;
  signup_code_error: undefined;
  signup_profile_submit: undefined;
  signup_complete: undefined;
  cta_click: { place: CtaPlace };
};

export type Track = <E extends keyof AnalyticsEvents>(
  event: E,
  ...props: AnalyticsEvents[E] extends undefined ? [] : [AnalyticsEvents[E]]
) => void;

// Системы аналитики в проекте пока нет: интерфейс зафиксирован, отправка не выполняется.
export const track: Track = () => {};
