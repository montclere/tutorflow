import { Plus } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudents } from "../../data";
import { Button } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/kit/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import styles from "./schedule.module.css";

const text = cabinet.teacher.schedule;

type Props = { label: string; style: CSSProperties };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function FreeSlot({ label, style }: Props) {
  const { notifySoon } = useNotifier();
  const [open, setOpen] = useState(false);
  const students = getStudents();

  const save = () => {
    notifySoon(text.quick.save);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={styles.free} style={style} aria-label={label}>
          <Plus size={14} aria-hidden="true" />
          {text.free}
        </button>
      </PopoverTrigger>
      <PopoverContent className="grid w-72 gap-3" align="start">
        <p className="m-0 font-[family-name:var(--font-display)] text-sm font-extrabold">{text.quick.title}</p>
        <p className="m-0 -mt-2 text-xs font-semibold text-muted-foreground tabular-nums">{label}</p>
        <Field label={text.quick.student}>
          <Select>
            <SelectTrigger aria-label={text.quick.student} className="w-full">
              <SelectValue placeholder={text.quick.chooseStudent} />
            </SelectTrigger>
            <SelectContent>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={text.quick.duration}>
          <Select defaultValue={text.quick.defaultDuration}>
            <SelectTrigger aria-label={text.quick.duration} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {text.quick.durations.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={text.quick.repeat}>
          <Select defaultValue={text.quick.defaultRepeat}>
            <SelectTrigger aria-label={text.quick.repeat} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {text.quick.repeats.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button variant="primary" onClick={save}>
          {text.quick.save}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
