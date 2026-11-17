import { useState } from "react";
import { navigate } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import { Card, CardAction, CardHeader } from "@/shared/ui/kit/card";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { LessonRow, LessonStatus, Tone } from "../../mocks/types";
import { Avatar } from "../../ui/Avatar";
import { Button, LinkButton } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { ListRow } from "../../ui/ListRow";
import { useNotifier } from "../../ui/Notifications";
import { Pill } from "../../ui/Pill";
import { RowList } from "../../ui/RowList";
import { Tabs } from "../../ui/Tabs";

const text = cabinet.teacher.overview.today;

type Day = (typeof text.days)[number]["id"];

const statusTones: Record<LessonStatus, Tone> = { done: "ok", soon: "blue", paid: "ok", debt: "bad" };

function statusLabel(lesson: LessonRow): string {
  return lesson.status === "soon" ? text.status.soon(lesson.minutes) : text.status[lesson.status];
}

export function TodayCard({ lessons }: { lessons: Record<Day, LessonRow[]> }) {
  const { notifySoon } = useNotifier();
  const [day, setDay] = useState<Day>("today");
  const rows = lessons[day];
  const nextIndex = rows.findIndex((lesson) => !lesson.past);

  return (
    <Card>
      <CardHeader>
        <h2 className="sr-only">{text.title}</h2>
        <Tabs
          label={text.tabsLabel}
          items={text.days.map((item) => ({ id: item.id, label: text.tabLabel(item.label, lessons[item.id].length) }))}
          selectedId={day}
          onSelect={(id) => setDay(id as Day)}
        />
        <CardAction className="self-center">
          <LinkButton onClick={() => navigate(teacherRoutes.schedule)}>{cabinet.common.schedule}</LinkButton>
        </CardAction>
      </CardHeader>
      <div className="px-5">
        {rows.length === 0 ? (
          <p className="m-0 py-6 text-center text-sm font-semibold text-muted-foreground">{text.empty}</p>
        ) : (
          <RowList>
            {rows.map((lesson, index) => {
              const student = getStudent(lesson.studentId);
              return (
                <ListRow
                  key={lesson.id}
                  muted={lesson.past}
                  lead={
                    <>
                      <span className={cx("w-12 flex-none font-[family-name:var(--font-display)] text-sm font-extrabold tabular-nums", lesson.past && "text-muted-foreground")}>
                        {lesson.time}
                      </span>
                      <Avatar initials={student.initials} color={student.color} muted={lesson.past} />
                    </>
                  }
                  title={student.name}
                  note={lesson.goal}
                >
                  <Pill tone={statusTones[lesson.status]}>{statusLabel(lesson)}</Pill>
                  <Button size="sm" variant={index === nextIndex ? "primary" : "default"} onClick={() => notifySoon(text.join)}>
                    {text.join}
                  </Button>
                </ListRow>
              );
            })}
          </RowList>
        )}
      </div>
    </Card>
  );
}
