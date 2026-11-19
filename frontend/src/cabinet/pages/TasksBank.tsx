import { Check, Plus, Shuffle, Sparkles } from "lucide-react";
import { useState } from "react";
import { canGenerate, makeAnalogs, seededRandom } from "../tasks/analogs";
import { bankByNumber, countByNumber } from "../tasks/bank";
import { examOf, examsOf, subjectOf, subjects } from "../tasks/catalog";
import { addToDraft, DRAFT_LIMIT, removeFromDraft, useDraft } from "../tasks/draft";
import { tasksText } from "../tasks/tasks.ru";
import type { Difficulty, SubjectId } from "../tasks/types";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { NumberGrid } from "../ui/NumberGrid";
import { useNotifier } from "../ui/Notifications";
import { ToolButton } from "../ui/TaskCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { DraftDock } from "./tasks/DraftDock";
import { TaskView } from "./tasks/TaskView";

const text = tasksText.bank;
const RANDOM_COUNT = 5;
const ANALOG_COUNT = 5;
const ALL = "all";

/** Банк заданий по предметам и экзаменам: отбираем задачи в черновик (TASKS-4). */
export function TasksBank() {
  const { notify } = useNotifier();
  const draft = useDraft();
  const [subject, setSubject] = useState<SubjectId>("russian");
  const [examId, setExamId] = useState("ege-russian");
  const exam = examOf(examId);
  const counts = countByNumber(examId);
  const firstNumber = exam?.numbers.find((item) => (counts.get(item.number) ?? 0) > 0)?.number ?? exam?.numbers[0]?.number ?? 1;
  const [number, setNumber] = useState(6);
  const [difficulty, setDifficulty] = useState<string>(ALL);
  const current = exam?.numbers.find((item) => item.number === number) ?? exam?.numbers.find((item) => item.number === firstNumber);
  const all = current ? bankByNumber(examId, current.number) : [];
  const shown = difficulty === ALL ? all : all.filter((task) => task.difficulty === Number(difficulty));
  const inDraft = new Set(draft.items.map((task) => task.id));
  const generatorBase = all.find(canGenerate);

  const add = (tasks: typeof all) => {
    if (draft.items.length >= DRAFT_LIMIT) {
      notify(tasksText.draft.limit(DRAFT_LIMIT));
      return;
    }
    notify(tasksText.draft.added(addToDraft(tasks)));
  };

  const changeSubject = (next: string) => {
    const nextExam = examsOf(next as SubjectId)[0];
    setSubject(next as SubjectId);
    if (nextExam) {
      setExamId(nextExam.id);
      setNumber(nextExam.numbers[0]?.number ?? 1);
    }
  };

  const changeExam = (next: string) => {
    setExamId(next);
    setNumber(examOf(next)?.numbers[0]?.number ?? 1);
  };

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1181px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card title={text.title} subtitle={text.subtitle}>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Select value={subject} onValueChange={changeSubject}>
                <SelectTrigger aria-label={text.subjectLabel} className="w-full bg-card font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={examId} onValueChange={changeExam}>
                <SelectTrigger aria-label={text.examLabel} className="w-full bg-card font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {examsOf(subject).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {exam && exam.numbers.length > 0 ? (
              <div role="group" aria-label={text.numbersLabel}>
                <NumberGrid
                  cells={exam.numbers.map((item) => ({ number: item.number, caption: String(counts.get(item.number) ?? 0), pressed: item.number === current?.number }))}
                  onPick={(picked) => {
                    setNumber(picked);
                    setDifficulty(ALL);
                  }}
                />
              </div>
            ) : (
              <p className="m-0 text-sm font-semibold text-muted-foreground">{text.noNumbers}</p>
            )}
            <p className="m-0 border-t pt-3 text-xs leading-relaxed font-semibold text-muted-foreground">{text.note}</p>
          </div>
        </Card>

        <Card
          title={current ? text.numberTitle(current.number, current.topic) : text.title}
          subtitle={`${subjectOf(subject).label} · ${exam?.label ?? ""} · ${text.numberSub(tasksText.count(all.length))}`}
        >
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ToggleGroup type="single" spacing={1} value={difficulty} aria-label={text.difficultyLabel} className="gap-1 rounded-lg border bg-card p-1" onValueChange={(value) => value && setDifficulty(value)}>
                {[ALL, "1", "2", "3"].map((level) => (
                  <ToggleGroupItem key={level} value={level} className="h-7 px-2.5 text-sm data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                    {level === ALL ? text.all : tasksText.difficulty[Number(level) as Difficulty]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  icon={Shuffle}
                  disabled={all.length === 0}
                  onClick={() => {
                    const random = seededRandom(Date.now());
                    add([...shown.filter((task) => !inDraft.has(task.id))].sort(() => random() - 0.5).slice(0, RANDOM_COUNT));
                  }}
                >
                  {text.random(RANDOM_COUNT)}
                </Button>
                {generatorBase && (
                  <Button size="sm" variant="lime" icon={Sparkles} title={text.analogsHint} onClick={() => add(makeAnalogs(generatorBase, ANALOG_COUNT, Date.now()))}>
                    {text.analogs}
                  </Button>
                )}
              </div>
            </div>
            {shown.length === 0 ? (
              <p className="m-0 rounded-xl border border-dashed px-4 py-8 text-center text-sm font-semibold text-muted-foreground">{text.empty}</p>
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0">
                {shown.map((task) => {
                  const added = inDraft.has(task.id);
                  return (
                    <li key={task.id}>
                      <TaskView
                        task={task}
                        tools={
                          added ? (
                            <ToolButton icon={Check} onClick={() => removeFromDraft(task.id)}>
                              {tasksText.task.inDraft}
                            </ToolButton>
                          ) : (
                            <ToolButton icon={Plus} onClick={() => add([task])}>
                              {tasksText.task.toDraft}
                            </ToolButton>
                          )
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>
      <DraftDock />
    </>
  );
}
