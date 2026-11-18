import { Check, ChevronsUpDown, Users } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import type { Student } from "../../mocks/types";
import { Avatar } from "../../ui/Avatar";
import { cx } from "../../ui/cx";
import { Button } from "@/shared/ui/kit/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/kit/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/kit/popover";

const text = cabinet.teacher.schedule.filters;

type Props = { students: Student[]; value: string | null; onChange: (studentId: string | null) => void };

export function StudentCombobox({ students, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = students.find((student) => student.id === value);

  const pick = (studentId: string | null) => {
    onChange(studentId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" role="combobox" aria-expanded={open} aria-label={text.student} className="w-52 justify-between max-[520px]:basis-full">
          <span className="flex min-w-0 items-center gap-2">
            <Users aria-hidden="true" className="text-muted-foreground" />
            <span className="truncate">{selected ? selected.name : text.allStudents}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={text.searchStudent} />
          <CommandList>
            <CommandEmpty>{text.noStudents}</CommandEmpty>
            <CommandGroup>
              <CommandItem value={text.allStudents} onSelect={() => pick(null)}>
                <Check aria-hidden="true" className={cx(value === null ? "opacity-100" : "opacity-0")} />
                {text.allStudents}
              </CommandItem>
              {students.map((student) => (
                <CommandItem key={student.id} value={student.name} onSelect={() => pick(student.id)}>
                  <Check aria-hidden="true" className={cx(value === student.id ? "opacity-100" : "opacity-0")} />
                  <Avatar initials={student.initials} color={student.color} />
                  <span className="truncate">{student.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
