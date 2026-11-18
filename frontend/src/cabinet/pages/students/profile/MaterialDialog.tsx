import { Upload, X } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { cabinet } from "../../../content/cabinet.ru";
import { addMaterials, getSchedule } from "../../../data";
import type { Student, StudentMaterial } from "../../../mocks/types";
import { MATERIAL_ACCEPT, fileProblem, formatBytes, isLink, materialKind, titleFromFileName } from "../../../model/materials";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";
import { useNotifier } from "../../../ui/Notifications";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Input } from "@/shared/ui/kit/input";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { MaterialIcon } from "../../../ui/MaterialIcon";

const text = cabinet.teacher.students.profile.materialForm;
const TITLE_MAX = 120;
const NOTE_MAX = 500;

type Mode = "file" | "link";
type Picked = { key: string; file: File; title: string };

function Form({ student, onClose }: { student: Student; onClose: () => void }) {
  const { notify } = useNotifier();
  const inputRef = useRef<HTMLInputElement>(null);
  const noteId = useId();
  const [mode, setMode] = useState<Mode>("file");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [link, setLink] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const [tried, setTried] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: Picked[] = [];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      const problem = fileProblem(file);
      if (problem) problems.push(text.errors[problem](file.name));
      else accepted.push({ key: `${file.name}-${file.size}-${file.lastModified}`, file, title: titleFromFileName(file.name) });
    }
    setPicked((current) => [...current, ...accepted.filter((item) => !current.some((existing) => existing.key === item.key))]);
    setRejected(problems);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const errors = {
    empty: mode === "file" && picked.length === 0,
    link: mode === "link" && !isLink(link),
    linkTitle: mode === "link" && linkTitle.trim() === "",
  };

  const submit = () => {
    setTried(true);
    if (errors.empty || errors.link || errors.linkTitle) return;
    const sentAt = getSchedule().today;
    const extra = { note: note.trim() || undefined, sentAt, openedAt: null };
    const materials: StudentMaterial[] =
      mode === "link"
        ? [{ id: `m-${Date.now()}`, title: linkTitle.trim(), kind: "link", url: link.trim(), ...extra }]
        : picked.map((item, index) => ({
            id: `m-${Date.now()}-${index}`,
            title: item.title.trim() || item.file.name,
            kind: materialKind(item.file.name),
            fileName: item.file.name,
            sizeBytes: item.file.size,
            // Демо: файл живёт в памяти браузера до перезагрузки; рабочую загрузку даст сервер.
            url: URL.createObjectURL(item.file),
            ...extra,
          }));
    addMaterials(student.id, materials);
    notify(text.done(materials.length));
    onClose();
  };

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-[family-name:var(--font-display)] text-xl font-black">{text.title}</DialogTitle>
        <DialogDescription>{text.description(student.name.split(" ")[0] ?? student.name)}</DialogDescription>
      </DialogHeader>

      <ToggleGroup type="single" spacing={1} value={mode} aria-label={text.modeLabel} className="w-full gap-1 rounded-lg border bg-card p-1" onValueChange={(value) => value && setMode(value as Mode)}>
        {(Object.keys(text.modes) as Mode[]).map((id) => (
          <ToggleGroupItem key={id} value={id} className="flex-1 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
            {text.modes[id]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {mode === "file" ? (
        <div className="grid gap-3">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cx(
              "grid place-items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors",
              dragging ? "border-primary bg-accent" : "border-border bg-secondary/40",
              tried && errors.empty && "border-destructive",
            )}
          >
            <span className="grid size-11 place-items-center rounded-full bg-card text-primary" aria-hidden="true">
              <Upload size={20} />
            </span>
            <p className="m-0 text-base font-bold">
              {text.drop}{" "}
              <button type="button" className="appearance-none border-0 bg-transparent p-0 font-bold text-primary underline-offset-4 [font:inherit] hover:underline" onClick={() => inputRef.current?.click()}>
                {text.choose}
              </button>
            </p>
            <p className="m-0 text-sm font-semibold text-muted-foreground">{text.dropHint}</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={MATERIAL_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
          {tried && errors.empty && <p className="m-0 text-sm font-semibold text-destructive">{text.errors.empty}</p>}
          {rejected.map((problem) => (
            <p key={problem} className="m-0 text-sm font-semibold text-destructive" role="alert">
              {problem}
            </p>
          ))}
          {picked.length > 0 && (
            <ul className="m-0 grid list-none gap-2 p-0">
              {picked.map((item) => (
                <li key={item.key} className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
                  <MaterialIcon kind={materialKind(item.file.name)} small />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <Input
                      value={item.title}
                      maxLength={TITLE_MAX}
                      aria-label={`${text.fileTitle}: ${item.file.name}`}
                      className="h-8"
                      onChange={(event) => setPicked((current) => current.map((entry) => (entry.key === item.key ? { ...entry, title: event.target.value } : entry)))}
                    />
                    <span className="truncate text-xs font-semibold text-muted-foreground">
                      {item.file.name} · {formatBytes(item.file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={text.removeFile(item.file.name)}
                    className="grid size-8 flex-none appearance-none place-items-center rounded-full border-0 bg-transparent text-muted-foreground hover:bg-secondary"
                    onClick={() => setPicked((current) => current.filter((entry) => entry.key !== item.key))}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-muted-foreground">{text.link}</span>
            <Input type="url" inputMode="url" value={link} placeholder={text.linkPlaceholder} aria-invalid={tried && errors.link} onChange={(event) => setLink(event.target.value)} />
            {tried && errors.link && <span className="text-sm font-semibold text-destructive">{text.errors.link}</span>}
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-muted-foreground">{text.linkTitle}</span>
            <Input value={linkTitle} maxLength={TITLE_MAX} placeholder={text.linkTitlePlaceholder} aria-invalid={tried && errors.linkTitle} onChange={(event) => setLinkTitle(event.target.value)} />
            {tried && errors.linkTitle && <span className="text-sm font-semibold text-destructive">{text.errors.linkTitle}</span>}
          </label>
        </div>
      )}

      <div className="grid gap-1.5">
        <label htmlFor={noteId} className="text-xs font-bold text-muted-foreground">
          {text.note}
          <span className="font-semibold"> · {text.optional}</span>
        </label>
        <textarea
          id={noteId}
          value={note}
          rows={2}
          maxLength={NOTE_MAX}
          placeholder={text.notePlaceholder}
          className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-base [font:inherit] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" onClick={onClose}>
          {text.cancel}
        </Button>
        <Button type="submit" variant="primary" icon={Upload}>
          {text.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Отправка материала ученику: файлы (перетаскиванием или выбором) или ссылка, с комментарием. */
export function MaterialDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  return (
    <Dialog open={student !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">{student && <Form key={student.id} student={student} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}
