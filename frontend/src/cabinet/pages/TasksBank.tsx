import { Copy, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { navigate } from "../../app/router";
import { teacherRoutes } from "../../config/routes";
import { cabinet } from "../content/cabinet.ru";
import { getTaskLab } from "../data";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { NumberGrid } from "../ui/NumberGrid";
import { useNotifier } from "../ui/Notifications";
import { Pill } from "../ui/Pill";
import { RichText } from "../ui/RichText";
import { TaskCard, ToolButton } from "../ui/TaskCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { Separator } from "@/shared/ui/kit/separator";
import ui from "../ui/ui.module.css";

const text = cabinet.teacher.tasks.bank;
const DEFAULT_NUMBER = 6;

export function TasksBank() {
  const { notifySoon } = useNotifier();
  const lab = getTaskLab();
  const [selected, setSelected] = useState(DEFAULT_NUMBER);
  const current = lab.numbers.find((item) => item.number === selected) ?? lab.numbers[0];

  if (!current) return null;

  return (
    <div className={`${ui.grid} ${ui.g12}`}>
      <Card
        title={text.title}
        subtitle={text.subtitle}
        action={
          <Select defaultValue={lab.exams[0]}>
            <SelectTrigger aria-label={text.examLabel} size="sm" className="w-40 bg-card text-xs font-extrabold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lab.exams.map((exam) => (
                <SelectItem key={exam} value={exam}>
                  {exam}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <NumberGrid
          cells={lab.numbers.map((item) => ({ number: item.number, caption: String(item.count), pressed: item.number === selected }))}
          onPick={setSelected}
        />
        <Separator className="my-4" />
        <p className="m-0 text-xs leading-relaxed font-semibold text-muted-foreground">{text.note}</p>
      </Card>

      <Card
        title={text.detailTitle(current.number, current.topic)}
        subtitle={text.detailSub(current.count)}
        action={
          <Button variant="lime" size="sm" icon={Sparkles} onClick={() => navigate(teacherRoutes.tasksCreate)}>
            {text.analogs}
          </Button>
        }
      >
        <div className="grid gap-3">
          {lab.prototypes.map((prototype) => (
            <TaskCard
              key={prototype.label}
              badge={<Pill tone="blue">{prototype.label}</Pill>}
              tools={
                <>
                  <ToolButton icon={Plus} onClick={() => notifySoon(text.toTask)}>
                    {text.toTask}
                  </ToolButton>
                  <ToolButton icon={Copy} onClick={() => notifySoon(text.similar)}>
                    {text.similar}
                  </ToolButton>
                </>
              }
              question={<RichText parts={prototype.question} />}
              source={prototype.source}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
