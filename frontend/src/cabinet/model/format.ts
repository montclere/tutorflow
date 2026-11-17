const rubles = new Intl.NumberFormat("ru-RU");

export function formatRubles(kopecks: number): string {
  return `${rubles.format(Math.abs(kopecks) / 100)} ₽`;
}

export function formatSigned(kopecks: number): string {
  if (kopecks < 0) return `−${formatRubles(kopecks)}`;
  if (kopecks > 0) return `+${formatRubles(kopecks)}`;
  return formatRubles(0);
}

export function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}
