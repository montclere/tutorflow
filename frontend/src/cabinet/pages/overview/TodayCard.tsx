import { Check } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { FreeWindowLink, LessonRow } from "../../mocks/types";
import { formatCountdown } from "../../model/format";
import { lessonMark, type LessonMark } from "../../model/overview";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { CabinetLink } from "../../ui/CabinetLink";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { Pill } from "../../ui/Pill";
import { scheduleHref } from "../schedule/useScheduleUrl";

const text = cabinet.teacher.overview.today;
const MAX_FREE_WINDOWS = 3;

type LineProps = { lesson: LessonRow; mark: LessonMark; onOpen: (id: string) => void; onMark: (id: string) => void };

function LessonLine({ lesson, mark, onOpen, onMark }: LineProps) {
  const student = getStudent(lesson.studentId);
  return (
    <li className={cx("flex items-center gap-3", mark === "marked" && "opacity-60")}>
      <button
        type="button"
        className="appearance-none border-0 bg-transparent text-inherit [font:inherit] -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-secondary"
        aria-label={text.openLesson(student.name, lesson.time)}
        onClick={() => onOpen(lesson.id)}
      >
        <span className="w-14 flex-none font-[family-name:var(--font-display)] text-base font-extrabold tabular-nums">{lesson.time}</span>
        <Avatar initials={student.initials} color={student.color} />
        <span className="min-w-0 flex-1">
          <b className="block truncate text-base font-extrabold">{student.name}</b>
          <span className="block truncate text-sm font-semibold text-muted-foreground">{lesson.goal}</span>
        </span>
      </button>
      {lesson.status === "debt" && <Pill tone="bad">{text.debt}</Pill>}
      {mark === "toMark" && (
        <Button size="sm" onClick={() => onMark(lesson.id)}>
          {text.mark}
        </Button>
      )}
      {mark === "marked" && <Check size={16} className="flex-none text-muted-foreground" aria-label={text.doneLabel} />}
    </li>
  );
}

function NextLesson({ lesson, onOpen, onJoin }: { lesson: LessonRow; onOpen: (id: string) => void; onJoin: () => void }) {
  const student = getStudent(lesson.studentId);
  return (
    <li className="my-2 rounded-2xl bg-primary p-5 text-primary-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-display)] text-3xl leading-none font-black tabular-nums">{lesson.time}</span>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold">{formatCountdown(lesson.minutes)}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="appearance-none border-0 bg-transparent text-inherit [font:inherit] -m-2 flex min-w-40 flex-1 items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/10"
          aria-label={text.openLesson(student.name, lesson.time)}
          onClick={() => onOpen(lesson.id)}
        >
          <Avatar initials={student.initials} color={student.color} />
          <span className="min-w-0 flex-1">
            <b className="block text-lg font-extrabold">{student.name}</b>
            <span className="block text-sm font-semibold text-white/75">{lesson.goal}</span>
          </span>
        </button>
        <Button variant="lime" onClick={onJoin}>
          {text.join}
        </Button>
      </div>
    </li>
  );
}

function EmptyToday({ windows, today }: { windows: FreeWindowLink[]; today: string }) {
  return (
    <div className="py-4">
      <p className="m-0 text-base font-extrabold">{text.empty}</p>
      {windows.length > 0 && (
        <>
          <p className="m-0 mt-3 text-sm font-semibold text-muted-foreground">{text.freeTitle}</p>
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
            {windows.slice(0, MAX_FREE_WINDOWS).map((window) => (
              <li key={window.label}>
                <CabinetLink
                  href={scheduleHref("day", window.date, today)}
                  className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm font-bold text-foreground no-underline tabular-nums transition-colors hover:bg-secondary"
                >
                  {window.label}
                </CabinetLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Props = {
  lessons: { today: LessonRow[]; tomorrow: LessonRow[] };
  freeWindows: FreeWindowLink[];
  today: string;
  onOpen: (id: string) => void;
};

export function TodayCard({ lessons, freeWindows, today, onOpen }: Props) {
  const { notify, notifySoon } = useNotifier();
  const [marked, setMarked] = useState<string[]>([]);
  const nextIndex = lessons.today.findIndex((lesson) => !lesson.past);

  const markDone = (id: string) => {
    setMarked((current) => [...current, id]);
    notify(cabinet.teacher.overview.attention.lessonDone);
  };

  const line = (lesson: LessonRow) => (
    <LessonLine key={lesson.id} lesson={lesson} mark={lessonMark(lesson, marked)} onOpen={onOpen} onMark={markDone} />
  );

  return (
    <Card title={text.title}>
      {lessons.today.length === 0 ? (
        <EmptyToday windows={freeWindows} today={today} />
      ) : (
        <ul className="m-0 list-none p-0">
          {lessons.today.map((lesson, index) =>
            index === nextIndex ? (
              <NextLesson key={lesson.id} lesson={lesson} onOpen={onOpen} onJoin={() => notifySoon(text.join)} />
            ) : (
              line(lesson)
            ),
          )}
        </ul>
      )}
      {lessons.tomorrow.length > 0 && (
        <>
          <h3 className="m-0 mt-5 border-t border-border pt-4 text-sm font-extrabold tracking-wide text-muted-foreground uppercase">{text.tomorrow}</h3>
          <ul className="m-0 list-none p-0">{lessons.tomorrow.map(line)}</ul>
        </>
      )}
    </Card>
  );
}
