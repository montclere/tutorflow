import { CloudMoon, MoonStars, Sun, SunHorizon } from "@phosphor-icons/react";
import { cabinet } from "../../content/cabinet.ru";
import { formatLongDay } from "../../model/dates";
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

const icons = { night: MoonStars, morning: SunHorizon, day: Sun, evening: CloudMoon } as const;

type Props = { name: string; today: string; now: string; summary: string };

/**
 * Приветствие на обзоре (VIBE-14): обращение по времени суток, имя с салатовым «маркером», как на сайте,
 * дата и сводка дня одной строкой; справа — стеклянный значок солнца или луны.
 */
export function Greeting({ name, today, now, summary }: Props) {
  const part = dayPart(now);
  const Icon = icons[part];
  return (
    <header className="mb-5 flex items-center justify-between gap-4">
      <div className="grid min-w-0 gap-1.5">
        <span className="text-sm font-bold text-muted-foreground">{formatLongDay(today)}</span>
        <h1 className="m-0 font-[family-name:var(--font-display)] text-[32px] leading-tight font-black tracking-tight text-balance max-[520px]:text-2xl">
          {text.parts[part]},{" "}
          <span className="relative isolate inline-block whitespace-nowrap">
            <span className="absolute inset-x-[-6px] bottom-[3px] -z-10 h-[42%] -rotate-1 rounded-md bg-[var(--color-lime)]" aria-hidden="true" />
            {name}
          </span>
          !
        </h1>
        <p className="m-0 text-base font-semibold text-muted-foreground">{summary}</p>
      </div>
      <span className="glass grid size-16 flex-none place-items-center rounded-3xl [--glass-bg:color-mix(in_srgb,var(--vibe-peach)_70%,transparent)] max-[520px]:hidden" aria-hidden="true">
        <Icon size={34} className={part === "night" || part === "evening" ? "text-[#7b4dff]" : "text-[#ff8a3d]"} />
      </span>
    </header>
  );
}
