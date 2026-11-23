/** Моменты времени из API (UTC, ISO 8601) — в часовом поясе профиля. */

export function formatInstantDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone }).format(new Date(iso));
}

export function formatInstant(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
}
