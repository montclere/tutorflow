import type { LiveLesson } from "../../../api/lessons";
import type { TeacherCard } from "../../../api/students";
import { cabinet } from "../../../content/cabinet.ru";
import { cardColor } from "../../../model/cardColor";
import { initialsOf } from "../../../model/newStudent";
import type { SchedulePeople } from "../schedulePeople";

const text = cabinet.teacher.schedule.live;

/** Кто на уроке в рабочей сборке: имя и цвет — из карточки, подпись — тема урока. Оплат на сервере нет. */
export function livePeople(lessons: Map<string, LiveLesson>, cards: Map<string, TeacherCard>): SchedulePeople {
  return {
    personOf: (lesson) => {
      const card = cards.get(lesson.studentId);
      const name = card?.name ?? text.unknownStudent;
      return { name, initials: initialsOf(name), color: cardColor(lesson.studentId), goal: lessons.get(lesson.id)?.title ?? "", payment: null };
    },
    factsOf: (lesson) => {
      const live = lessons.get(lesson.id);
      if (!live) return [];
      return [
        { label: text.facts.preparation, value: live.preparation },
        { label: text.facts.note, value: live.privateNote },
        { label: text.facts.reason, value: live.outcomeReason },
      ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));
    },
  };
}
