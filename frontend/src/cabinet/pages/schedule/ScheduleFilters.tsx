import { Palette } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import type { LessonType, Student } from "../../mocks/types";
import type { LessonFilters } from "../../model/lessons";
import type { ScheduleView } from "../../model/scheduleRange";
import { Button } from "../../ui/Button";
import type { ColorMode } from "./scheduleStyle";
import { StudentCombobox } from "./StudentCombobox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/shared/ui/kit/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { Switch } from "@/shared/ui/kit/switch";

const text = cabinet.teacher.schedule;
const ALL = "all";

type Props = {
  students: Student[];
  subjects: string[];
  filters: LessonFilters;
  colorMode: ColorMode;
  view: ScheduleView;
  withWeekend: boolean;
  summary: string;
  onFilters: (filters: LessonFilters) => void;
  onColorMode: (mode: ColorMode) => void;
  onWeekend: (value: boolean) => void;
};

export function ScheduleFilters({ students, subjects, filters, colorMode, view, withWeekend, summary, onFilters, onColorMode, onWeekend }: Props) {
  const colorLabel = text.colorModes.find((mode) => mode.id === colorMode)?.label ?? "";

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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button icon={Palette} className="max-[520px]:min-w-0 max-[520px]:flex-1">
            {text.filters.colorBy}: {colorLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup value={colorMode} onValueChange={(value) => onColorMode(value as ColorMode)}>
            {text.colorModes.map((mode) => (
              <DropdownMenuRadioItem key={mode.id} value={mode.id}>
                {mode.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {view === "week" && (
        <label className="inline-flex items-center gap-2 text-sm font-bold">
          <Switch checked={withWeekend} onCheckedChange={onWeekend} />
          {text.filters.weekend}
        </label>
      )}

      <p className="m-0 ml-auto text-sm font-bold text-muted-foreground tabular-nums max-[820px]:ml-0 max-[820px]:w-full">{summary}</p>
    </div>
  );
}
