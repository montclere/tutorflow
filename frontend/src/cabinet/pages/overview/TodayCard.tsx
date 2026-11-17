import { Check } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { LessonRow } from "../../mocks/types";
import { formatCountdown } from "../../model/format";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { Pill } from "../../ui/Pill";

const text = cabinet.teacher.overview.today;

function LessonLine({ lesson }: { lesson: LessonRow }) {
  const student = getStudent(lesson.studentId);
  return (
    <li className={cx("flex items-center gap-3 py-3", lesson.past && "opacity-60")}>
      <span className="w-14 flex-none font-[family-name:var(--font-display)] text-base font-extrabold tabular-nums">{lesson.time}</span>
      <Avatar initials={student.initials} color={student.color} />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-base font-extrabold">{student.name}</b>
        <span className="block truncate text-sm font-semibold text-muted-foreground">{lesson.goal}</span>
      </div>
      {lesson.status === "debt" && <Pill tone="bad">{text.debt}</Pill>}
      {lesson.past && <Check size={16} className="flex-none text-muted-foreground" aria-label={text.doneLabel} />}
    </li>
  );
}

function NextLesson({ lesson, onJoin }: { lesson: LessonRow; onJoin: () => void }) {
  const student = getStudent(lesson.studentId);
  return (
    <li className="my-2 rounded-2xl bg-primary p-5 text-primary-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-display)] text-3xl leading-none font-black tabular-nums">{lesson.time}</span>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold">{formatCountdown(lesson.minutes)}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Avatar initials={student.initials} color={student.color} />
        <div className="min-w-40 flex-1">
          <b className="block text-lg font-extrabold">{student.name}</b>
          <span className="block text-sm font-semibold text-white/75">{lesson.goal}</span>
        </div>
        <Button variant="lime" onClick={onJoin}>
          {text.join}
        </Button>
      </div>
    </li>
  );
}

export function TodayCard({ lessons }: { lessons: { today: LessonRow[]; tomorrow: LessonRow[] } }) {
  const { notifySoon } = useNotifier();
  const nextIndex = lessons.today.findIndex((lesson) => !lesson.past);

  return (
    <Card title={text.title}>
      {lessons.today.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm font-semibold text-muted-foreground">{text.empty}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {lessons.today.map((lesson, index) =>
            index === nextIndex ? (
              <NextLesson key={lesson.id} lesson={lesson} onJoin={() => notifySoon(text.join)} />
            ) : (
              <LessonLine key={lesson.id} lesson={lesson} />
            ),
          )}
        </ul>
      )}
      {lessons.tomorrow.length > 0 && (
        <>
          <h3 className="m-0 mt-5 border-t border-border pt-4 text-sm font-extrabold tracking-wide text-muted-foreground uppercase">{text.tomorrow}</h3>
          <ul className="m-0 list-none p-0">
            {lessons.tomorrow.map((lesson) => (
              <LessonLine key={lesson.id} lesson={lesson} />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
