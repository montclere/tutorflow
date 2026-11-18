import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { ru } from "react-day-picker/locale";
import { cabinet } from "../../content/cabinet.ru";
import { parseDate, toDateString } from "../../model/dates";
import { periodTitle, stepDate, type ScheduleView } from "../../model/scheduleRange";
import { Button, IconButton } from "../../ui/Button";
import { Calendar } from "@/shared/ui/kit/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/kit/popover";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";

const text = cabinet.teacher.schedule;

type Props = {
  view: ScheduleView;
  date: string;
  today: string;
  onChange: (next: { view?: ScheduleView; date?: string }) => void;
  onAdd: () => void;
};

export function ScheduleHeader({ view, date, today, onChange, onAdd }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <h1 className="m-0 mr-1 font-[family-name:var(--font-display)] text-2xl leading-tight font-black tracking-tight max-[520px]:text-xl">
            <PopoverTrigger asChild>
              <button
                type="button"
                className="-ml-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-transparent bg-transparent px-2 text-left font-[inherit] text-[length:inherit] leading-[inherit] font-black tracking-[inherit] transition-colors duration-150 hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/40 motion-reduce:transition-none"
                aria-label={`${text.pickDate}: ${periodTitle(view, date)}`}
              >
                {periodTitle(view, date)}
                <CalendarDays size={18} className="text-muted-foreground" aria-hidden="true" />
              </button>
            </PopoverTrigger>
          </h1>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              locale={ru}
              weekStartsOn={1}
              selected={parseDate(date)}
              defaultMonth={parseDate(date)}
              onSelect={(selected) => {
                if (!selected) return;
                onChange({ date: toDateString(selected) });
                setPickerOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        <IconButton icon={ChevronLeft} label={text.step[view].prev} onClick={() => onChange({ date: stepDate(view, date, -1) })} />
        <IconButton icon={ChevronRight} label={text.step[view].next} onClick={() => onChange({ date: stepDate(view, date, 1) })} />
        <Button onClick={() => onChange({ date: today })}>{text.today}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={view}
          spacing={1}
          aria-label={text.viewLabel}
          className="gap-1 rounded-lg border bg-card p-1 max-[520px]:w-full"
          onValueChange={(value) => value && onChange({ view: value as ScheduleView })}
        >
          {text.views.map((item) => (
            <ToggleGroupItem key={item.id} value={item.id} className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground max-[520px]:flex-1">
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button variant="primary" icon={Plus} onClick={onAdd}>
          {text.addLesson}
        </Button>
      </div>
    </div>
  );
}
