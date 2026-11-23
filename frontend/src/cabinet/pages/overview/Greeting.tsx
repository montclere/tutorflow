import { cabinet } from "../../content/cabinet.ru";
import { toMinutes } from "../../model/time";

const text = cabinet.teacher.overview.hello;

type DayPart = "night" | "morning" | "day" | "evening";

export function dayPart(time: string): DayPart {
  const minutes = toMinutes(time);
  if (minutes < 5 * 60) return "night";
  if (minutes < 12 * 60) return "morning";
  if (minutes < 18 * 60) return "day";
  return "evening";
}

/**
 * Приветствие на обзоре (VIBE-14): только обращение по времени суток и имя. Под всей фразой — небрежный
 * салатовый мазок маркером: два неровных штриха, как от руки.
 */
export function Greeting({ name, now }: { name: string; now: string }) {
  return (
    <header className="mb-6">
      <h1 className="relative isolate m-0 inline-block font-[family-name:var(--font-display)] text-[34px] leading-tight font-black tracking-tight max-[520px]:text-[26px]">
        <svg className="absolute -right-3 bottom-[-2px] -left-2 -z-10 h-[58%] w-[calc(100%+20px)] overflow-visible" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M6 26 C 48 17, 96 31, 150 22 S 252 13, 300 23 S 368 18, 394 12" fill="none" stroke="var(--color-lime)" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 33 C 90 25, 170 36, 246 28 S 350 26, 386 20" fill="none" stroke="var(--color-lime)" strokeWidth="7" strokeLinecap="round" opacity="0.75" />
        </svg>
        {text.parts[dayPart(now)]}, {name}!
      </h1>
    </header>
  );
}
