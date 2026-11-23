import { CalendarDays, Clock3, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import type { LessonType } from "../../mocks/types";
import type { LessonFilters } from "../../model/lessons";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { StudentCombobox, type ComboboxStudent } from "./StudentCombobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";

import styles from "./schedule.module.css";

const text = cabinet.teacher.schedule;
const ALL = "all";

type Props = {
  students: ComboboxStudent[];
  /** Тип урока (индивидуальный, группа, пробный) есть только у тестовых данных. */
  showType?: boolean;
  filters: LessonFilters;
  summary: string;
  lessonCount?: number;
  windowCount?: number;
  onFilters: (filters: LessonFilters) => void;
};

export function ScheduleFilters({ students, showType = true, filters, summary, lessonCount, windowCount, onFilters }: Props) {
  // На телефоне фильтры свёрнуты за кнопкой, чтобы шапка не съедала экран до первого урока.
  const [open, setOpen] = useState(false);
  const active = Number(filters.studentId !== null) + Number(filters.type !== null);

  return (
    <div className={styles.filters}>
      <span className="min-[521px]:hidden">
        <Button size="sm" icon={SlidersHorizontal} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          {text.filters.toggle(active)}
        </Button>
      </span>
      <div className={cx("flex flex-wrap items-center gap-2 max-[520px]:w-full max-[520px]:order-last", !open && "max-[520px]:hidden")}>
        <StudentCombobox students={students} value={filters.studentId} onChange={(studentId) => onFilters({ ...filters, studentId })} />

        {showType && (
        <Select value={filters.type ?? ALL} onValueChange={(value) => onFilters({ ...filters, type: value === ALL ? null : (value as LessonType) })}>
          <SelectTrigger aria-label={text.filters.type} className="w-44 max-[520px]:min-w-0 max-[520px]:flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{text.filters.allTypes}</SelectItem>
            {(Object.keys(text.types) as LessonType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {text.types[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        )}
      </div>

      <div className={styles.summary} aria-label={summary}>
        {lessonCount !== undefined && windowCount !== undefined ? <>
          <span><CalendarDays size={19} aria-hidden="true" /><b>{lessonCount}</b>{text.summaryLessons(lessonCount)}</span>
          <span><Clock3 size={19} aria-hidden="true" /><b>{windowCount}</b>{text.summaryWindows(windowCount)}</span>
        </> : summary}
      </div>
    </div>
  );
}
