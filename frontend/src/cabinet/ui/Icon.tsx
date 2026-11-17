import type { IconName } from "../content/cabinet.ru";

const paths: Record<IconName, string> = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  calendar: "M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM3 10h18M8 3v4M16 3v4",
  users: "M13 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 1 0 0-6M22 21c0-3-2-5-4-5.5",
  tasks: "M7 3h10a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM8 8h8M8 12h8M8 16h5",
  check: "M4 12l5 5L20 6",
  money: "M5 6h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  flag: "M5 21V4h11l-2 4 2 4H5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
