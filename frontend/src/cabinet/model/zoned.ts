/**
 * Время в часовом поясе профиля (docs/api/lessons.md): API принимает и отдаёт UTC, интерфейс показывает
 * и принимает дату и время в зоне профиля. Без библиотек — через Intl.
 */

export type ZonedParts = { date: string; time: string };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let cached = formatters.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    formatters.set(timeZone, cached);
  }
  return cached;
}

function wallClock(ms: number, timeZone: string) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) };
}

/** Смещение зоны в момент ms, в миллисекундах (Новосибирск: +7 ч). */
function offsetAt(ms: number, timeZone: string): number {
  const wall = wallClock(ms, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return asUtc - Math.floor(ms / 60_000) * 60_000;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Момент из API — дата и время на часах зоны. */
export function zonedParts(iso: string | number, timeZone: string): ZonedParts {
  const wall = wallClock(typeof iso === "number" ? iso : Date.parse(iso), timeZone);
  return { date: `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`, time: `${pad(wall.hour)}:${pad(wall.minute)}` };
}

/** Дата и время на часах зоны — момент UTC до минуты, как ждёт API: 2026-11-23T10:00:00Z. */
export function zonedToUtc(date: string, time: string, timeZone: string): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Второй проход уточняет смещение рядом с переходом на летнее время.
  let ms = guess - offsetAt(guess, timeZone);
  ms = guess - offsetAt(ms, timeZone);
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** «Сегодня» и «сейчас» на часах зоны профиля. */
export function nowIn(timeZone: string, now: number = Date.now()): { today: string; now: string } {
  const parts = zonedParts(now, timeZone);
  return { today: parts.date, now: parts.time };
}
