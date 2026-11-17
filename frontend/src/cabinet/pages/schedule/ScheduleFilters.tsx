import { cabinet } from "../../content/cabinet.ru";
import type { LessonType, Student } from "../../mocks/types";
import type { LessonFilters } from "../../model/lessons";
import { StudentCombobox } from "./StudentCombobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";

const text = cabinet.teacher.schedule;
const ALL = "all";

type Props = {
  students: Student[];
  subjects: string[];
  filters: LessonFilters;
  summary: string;
  onFilters: (filters: LessonFilters) => void;
};

export function ScheduleFilters({ students, subjects, filters, summary, onFilters }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
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

      {subjects.length >= 2 && (
        <Select value={filters.subject ?? ALL} onValueChange={(value) => onFilters({ ...filters, subject: value === ALL ? null : value })}>
          <SelectTrigger aria-label={text.filters.subject} className="w-44 max-[520px]:min-w-0 max-[520px]:flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{text.filters.allSubjects}</SelectItem>
            {subjects.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <p className="m-0 ml-auto text-sm font-bold text-muted-foreground tabular-nums max-[820px]:ml-0 max-[820px]:w-full">{summary}</p>
    </div>
  );
}
