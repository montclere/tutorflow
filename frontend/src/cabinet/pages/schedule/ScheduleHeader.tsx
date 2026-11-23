import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { ru } from "react-day-picker/locale";
import { cabinet } from "../../content/cabinet.ru";
import { parseDate, toDateString } from "../../model/dates";
import { periodTitle, stepDate, viewRange, type ScheduleView } from "../../model/scheduleRange";
import { Button, IconButton } from "../../ui/Button";
import { Calendar } from "@/shared/ui/kit/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/kit/popover";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";

import styles from "./schedule.module.css";

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
  const range = viewRange(view, date);
  // На телефоне «Сегодня» лишняя строка, если сегодняшний день уже на экране.
  const showsToday = today >= range.from && today <= range.to;

  return (
    <div className={styles.header}>
      <div className={styles.headerStart}>
        <h1 className={styles.title}>{text.title}</h1>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={styles.datePicker}
                aria-label={`${text.pickDate}: ${periodTitle(view, date)}`}
              >
                <CalendarDays size={19} aria-hidden="true" />
                {periodTitle(view, date)}
              </button>
            </PopoverTrigger>
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
        <Button onClick={() => onChange({ date: today })} className={showsToday ? "max-[520px]:hidden" : undefined}>
          {text.today}
        </Button>
      </div>
      <div className={styles.headerActions}>
        <ToggleGroup
          type="single"
          value={view}
          spacing={1}
          aria-label={text.viewLabel}
          className={styles.viewSwitch}
          onValueChange={(value) => value && onChange({ view: value as ScheduleView })}
        >
          {text.views.map((item) => (
            <ToggleGroupItem key={item.id} value={item.id} className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground max-[520px]:flex-1">
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button variant="primary" icon={Plus} onClick={onAdd} className="max-[520px]:hidden">
          {text.addLesson}
        </Button>
      </div>
    </div>
  );
}
