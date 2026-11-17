import { getStudent } from "../../data";
import type { ScheduleLesson } from "../../mocks/types";
import { cx } from "../../ui/cx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";
import { lessonSummary, lessonTime, PaymentBadge, RecurringIcon } from "./LessonMeta";
import type { ColorMode } from "./scheduleStyle";
import { lessonColorStyle } from "./scheduleStyle";
import styles from "./schedule.module.css";

type Props = {
  lesson: ScheduleLesson;
  past: boolean;
  colorMode: ColorMode;
  position: { top: string; height: string; left: string; width: string };
  onOpen: (lesson: ScheduleLesson) => void;
};

export function LessonBlock({ lesson, past, colorMode, position, onOpen }: Props) {
  const student = getStudent(lesson.studentId);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cx(styles.block, past && styles.past)}
          style={{ ...lessonColorStyle(student, colorMode), ...position }}
          onClick={() => onOpen(lesson)}
          aria-label={lessonSummary(lesson, student)}
        >
          <span className={styles.blockName}>{student.name}</span>
          <span className={styles.blockTime}>{lessonTime(lesson)}</span>
          <span className={styles.blockMeta}>
            <PaymentBadge payment={student.payment} />
            {lesson.recurring && <RecurringIcon />}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{lessonSummary(lesson, student)}</TooltipContent>
    </Tooltip>
  );
}
