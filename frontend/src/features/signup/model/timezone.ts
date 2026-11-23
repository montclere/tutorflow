export type Timezone = { id: string; label: string };

export function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

export function describeTimezone(id: string, offsetMinutes: number, cities: Record<string, string>): string {
  const city = id.split("/").pop() ?? id;
  return `${cities[city] ?? id} (${formatUtcOffset(offsetMinutes)})`;
}

export function detectTimezone(cities: Record<string, string>): Timezone | null {
  try {
    const id = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!id) return null;
    return { id, label: describeTimezone(id, -new Date().getTimezoneOffset(), cities) };
  } catch {
    return null;
  }
}
