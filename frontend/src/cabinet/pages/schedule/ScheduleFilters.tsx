import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import type { LessonType, Student } from "../../mocks/types";
import type { LessonFilters } from "../../model/lessons";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { StudentCombobox } from "./StudentCombobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";

const text = cabinet.teacher.schedule;
const ALL = "all";

type Props = {
  students: Student[];
  filters: LessonFilters;
  summary: string;
  onFilters: (filters: LessonFilters) => void;
};

export function ScheduleFilters({ students, filters, summary, onFilters }: Props) {
  // На телефоне фильтры свёрнуты за кнопкой, чтобы шапка не съедала экран до первого урока.
  const [open, setOpen] = useState(false);
  const active = Number(filters.studentId !== null) + Number(filters.type !== null);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="min-[521px]:hidden">
        <Button size="sm" icon={SlidersHorizontal} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          {text.filters.toggle(active)}
        </Button>
      </span>
      <div className={cx("flex flex-wrap items-center gap-2 max-[520px]:w-full max-[520px]:order-last", !open && "max-[520px]:hidden")}>
        <StudentCombobox students={students} value={filters.studentId} onChange={(studentId) => onFilters({ ...filters, studentId })} />

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
      </div>

      <p className="m-0 ml-auto text-sm font-bold text-muted-foreground tabular-nums max-[820px]:ml-0 max-[820px]:w-full max-[520px]:w-auto">{summary}</p>
    </div>
  );
}
