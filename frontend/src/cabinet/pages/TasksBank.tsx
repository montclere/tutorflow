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
import ui from "../ui/ui.module.css";
import styles from "./pages.module.css";

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
          <select className={styles.examSelect} aria-label={text.examLabel}>
            {lab.exams.map((exam) => (
              <option key={exam}>{exam}</option>
            ))}
          </select>
        }
      >
        <NumberGrid
          cells={lab.numbers.map((item) => ({ number: item.number, caption: String(item.count), pressed: item.number === selected }))}
          onPick={setSelected}
        />
        <p className={styles.note}>{text.note}</p>
      </Card>

      <Card
        title={text.detailTitle(current.number, current.topic)}
        subtitle={text.detailSub(current.count)}
        action={
          <Button variant="lime" size="sm" onClick={() => navigate(teacherRoutes.tasksCreate)}>
            {text.analogs}
          </Button>
        }
      >
        <div className={ui.stack}>
          {lab.prototypes.map((prototype) => (
            <TaskCard
              key={prototype.label}
              badge={<Pill tone="blue">{prototype.label}</Pill>}
              tools={
                <>
                  <ToolButton onClick={() => notifySoon(text.toTask)}>{text.toTask}</ToolButton>
                  <ToolButton onClick={() => notifySoon(text.similar)}>{text.similar}</ToolButton>
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
