import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { getSchedule } from "../../data";
import { getDraft, setDraftItems } from "../../tasks/draft";
import { notForTest, saveWork, type HomeworkFormat, type TestMode, type Work, type WorkKind } from "../../tasks/library";
import { tasksText } from "../../tasks/tasks.ru";
import { Button } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Input } from "@/shared/ui/kit/input";
import { Choice, Field } from "./Choice";

const text = tasksText.save;
const TIMES = [null, 10, 20, 30, 45] as const;
const ATTEMPTS = [1, 2, 3, null] as const;

type Props = { kind: WorkKind | null; onClose: () => void; onSaved: (work: Work, assign: boolean) => void };

function Form({ kind: initialKind, onClose, onSaved }: Omit<Props, "kind"> & { kind: WorkKind }) {
  const { notify } = useNotifier();
  const draft = getDraft();
  const [kind, setKind] = useState<WorkKind>(initialKind);
  const [title, setTitle] = useState(draft.title);
  const [tried, setTried] = useState(false);
  const [format, setFormat] = useState<HomeworkFormat>("online");
  // По умолчанию — тренировка: проверка сразу после ответа.
  const [mode, setMode] = useState<TestMode>("training");
  const [time, setTime] = useState<string>("none");
  const [attempts, setAttempts] = useState<string>("none");
  const blocked = kind === "test" ? notForTest(draft.items) : [];

  const save = (assign: boolean, items = draft.items) => {
    setTried(true);
    if (title.trim() === "") return;
    const work = saveWork({
      kind,
      title: title.trim(),
      items,
      createdAt: getSchedule().today,
      ...(kind === "test" ? { test: { mode, timeLimitMin: time === "none" ? null : Number(time), attempts: attempts === "none" ? null : Number(attempts) } } : { format }),
    });
    notify(text.saved[kind]);
    onSaved(work, assign);
  };

  const dropAndSave = (assign: boolean) => {
    const items = draft.items.filter((task) => !blocked.includes(task));
    setDraftItems(items);
    save(assign, items);
  };

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save(false);
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-[family-name:var(--font-display)] text-xl font-black">{text.title[kind]}</DialogTitle>
        <DialogDescription>{text.description[kind]}</DialogDescription>
      </DialogHeader>

      <label className="grid gap-1.5">
        <span className="text-xs font-bold text-muted-foreground">{text.name}</span>
        <Input value={title} maxLength={120} placeholder={text.namePlaceholder} aria-invalid={tried && title.trim() === ""} onChange={(event) => setTitle(event.target.value)} />
        {tried && title.trim() === "" && <span className="text-sm font-semibold text-destructive">{text.nameRequired}</span>}
      </label>

      {kind === "homework" ? (
        <Field label={text.format}>
          <Choice label={text.format} value={format} items={(["online", "print"] as const).map((id) => ({ id, label: text.formats[id] }))} onChange={setFormat} />
        </Field>
      ) : (
        <>
          <Field label={text.mode} hint={text.modeHints[mode]}>
            <Choice label={text.mode} value={mode} items={(["training", "control"] as const).map((id) => ({ id, label: text.modes[id] }))} onChange={setMode} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={text.time}>
              <Choice label={text.time} value={time} items={TIMES.map((value) => ({ id: value === null ? "none" : String(value), label: value === null ? "∞" : String(value) }))} onChange={setTime} />
            </Field>
            <Field label={text.attempts}>
              <Choice label={text.attempts} value={attempts} items={ATTEMPTS.map((value) => ({ id: value === null ? "none" : String(value), label: value === null ? "∞" : text.attemptsCount(value) }))} onChange={setAttempts} />
            </Field>
          </div>
          {blocked.length > 0 && (
            <div className="grid gap-3 rounded-xl border border-[var(--cab-warn)] bg-[var(--cab-warn-soft)] p-3.5" role="alert">
              <p className="m-0 flex items-start gap-2 text-sm font-bold">
                <AlertTriangle size={16} className="mt-0.5 flex-none text-[var(--cab-warn)]" aria-hidden="true" />
                {text.notAuto(blocked.length)}
              </p>
              <ul className="m-0 grid gap-0.5 pl-6 text-sm font-semibold">
                {blocked.map((task) => (
                  <li key={task.id}>
                    {draft.items.indexOf(task) + 1}. {task.topic} · {tasksText.answerKinds[task.answer.kind]}
                  </li>
                ))}
              </ul>
              <p className="m-0 text-xs font-semibold text-muted-foreground">{text.notAutoHint}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="primary" disabled={blocked.length === draft.items.length} onClick={() => dropAndSave(false)}>
                  {text.dropAndSave(blocked.length)}
                </Button>
                <Button type="button" size="sm" onClick={() => setKind("homework")}>
                  {text.saveAsHomework}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <DialogFooter className="gap-2">
        <Button type="button" onClick={onClose}>
          {text.cancel}
        </Button>
        <Button type="button" disabled={blocked.length > 0} onClick={() => save(true)}>
          {text.submitAndAssign}
        </Button>
        <Button type="submit" variant="primary" disabled={blocked.length > 0}>
          {text.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Сохранение черновика как задания или теста; тест не берёт задачи без автопроверки (TASKS-5). */
export function SaveWorkDialog({ kind, onClose, onSaved }: Props) {
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">{kind && <Form key={kind} kind={kind} onClose={onClose} onSaved={onSaved} />}</DialogContent>
    </Dialog>
  );
}
