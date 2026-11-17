import { getStudent } from "../../data";
import type { ScheduleLesson } from "../../mocks/types";
import { cabinet } from "../../content/cabinet.ru";
import { cx } from "../../ui/cx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";
import { lessonSummary, lessonTime } from "./LessonMeta";
import { lessonColorStyle } from "./scheduleStyle";
import styles from "./schedule.module.css";

type Props = {
  lesson: ScheduleLesson;
  past: boolean;
  position: { top: string; height: string; left: string; width: string };
  onOpen: (lesson: ScheduleLesson) => void;
};

export function LessonBlock({ lesson, past, position, onOpen }: Props) {
  const student = getStudent(lesson.studentId);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cx(styles.block, past && styles.past)}
          style={{ ...lessonColorStyle(student), ...position }}
          onClick={() => onOpen(lesson)}
          aria-label={lessonSummary(lesson, student)}
        >
          <span className={styles.blockName}>{student.name.split(" ")[0]}</span>
          <span className={styles.blockTime}>{lessonTime(lesson)}</span>
          {student.payment === "debt" && <span className={styles.blockDebt}>{cabinet.teacher.schedule.pay.debt}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent>{lessonSummary(lesson, student)}</TooltipContent>
    </Tooltip>
  );
}
