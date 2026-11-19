import { Camera, Check, X } from "lucide-react";
import { useId, useRef } from "react";
import { tasksText } from "../../../tasks/tasks.ru";
import type { AnswerResponse, AnswerSpec } from "../../../tasks/types";
import { cx } from "../../../ui/cx";

const text = tasksText.player;
const MAX_PHOTOS = 5;

type Props = {
  spec: AnswerSpec;
  value: AnswerResponse;
  onChange: (value: AnswerResponse) => void;
  /** После проверки ответ менять нельзя (тренировка). */
  locked?: boolean;
  onSubmit?: () => void;
};

const letter = (index: number) => String.fromCharCode(0x0410 + index);

/** Поле ответа под тип задачи — одинаково для всех предметов (TASKS-8). */
export function AnswerInput({ spec, value, onChange, locked, onSubmit }: Props) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  if ((spec.kind === "number" || spec.kind === "text") && (value.kind === "number" || value.kind === "text")) {
    return (
      <div className="grid gap-1.5">
        <label htmlFor={id} className="text-sm font-bold text-muted-foreground">
          {spec.kind === "number" ? text.numberLabel : text.textLabel}
        </label>
        <input
          id={id}
          value={value.value}
          disabled={locked}
          inputMode={spec.kind === "number" ? "decimal" : "text"}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={60}
          onChange={(event) => onChange({ ...value, value: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit?.();
            }
          }}
          className="h-14 w-full max-w-sm rounded-xl border-2 border-input bg-card px-4 font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-wide outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-70"
        />
        <span className="text-xs font-semibold text-muted-foreground">{spec.kind === "number" ? text.numberHint : text.textHint}</span>
      </div>
    );
  }

  if (spec.kind === "choice" && value.kind === "choice") {
    const many = spec.correct.length > 1;
    const toggle = (index: number) => {
      if (locked) return;
      const selected = many ? (value.selected.includes(index) ? value.selected.filter((item) => item !== index) : [...value.selected, index]) : [index];
      onChange({ kind: "choice", selected });
    };
    return (
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-2 text-sm font-bold text-muted-foreground">{many ? text.chooseMany : text.chooseOne}</legend>
        {spec.options.map((option, index) => {
          const on = value.selected.includes(index);
          return (
            <button
              key={option}
              type="button"
              role={many ? "checkbox" : "radio"}
              aria-checked={on}
              disabled={locked}
              onClick={() => toggle(index)}
              className={cx(
                "flex w-full appearance-none items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base font-bold text-foreground [font-family:inherit] transition-colors disabled:cursor-default",
                on ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/50",
              )}
            >
              <span className={cx("grid size-7 flex-none place-items-center text-sm font-extrabold tabular-nums", many ? "rounded-md" : "rounded-full", on ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                {on ? <Check size={15} aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">{option}</span>
            </button>
          );
        })}
      </fieldset>
    );
  }

  if (spec.kind === "match" && value.kind === "match") {
    return (
      <div className="grid gap-3">
        <p className="m-0 text-sm font-bold text-muted-foreground">{text.matchHint}</p>
        <ol className="m-0 grid list-none gap-1.5 p-0 text-sm font-semibold">
          {spec.right.map((right, index) => (
            <li key={right} className="flex gap-2">
              <b className="w-5 tabular-nums">{index + 1}</b>
              {right}
            </li>
          ))}
        </ol>
        {spec.left.map((left, row) => (
          <div key={left} className="grid gap-2 rounded-xl border bg-card p-3" role="radiogroup" aria-label={text.matchRow(left)}>
            <b className="text-base font-extrabold">
              {letter(row)}) {left}
            </b>
            <div className="flex flex-wrap gap-2">
              {spec.right.map((right, column) => {
                const on = value.pairs[row] === column;
                return (
                  <button
                    key={right}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${column + 1}: ${right}`}
                    disabled={locked}
                    onClick={() => onChange({ kind: "match", pairs: value.pairs.map((pair, index) => (index === row ? column : pair)) })}
                    className={cx(
                      "grid size-11 appearance-none place-items-center rounded-xl border-2 font-[family-name:var(--font-display)] text-base font-extrabold [font-family:inherit] transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50",
                    )}
                  >
                    {column + 1}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (spec.kind === "extended" && value.kind === "extended") {
    return (
      <div className="grid gap-2">
        <span className="text-sm font-bold text-muted-foreground">{text.photosLabel}</span>
        <span className="text-xs font-semibold text-muted-foreground">{text.photosHint}</span>
        {value.photos.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {value.photos.map((name) => (
              <li key={name} className="flex items-center gap-2 rounded-lg border bg-card py-1.5 pr-1.5 pl-3 text-sm font-semibold">
                <Camera size={14} aria-hidden="true" />
                <span className="max-w-48 truncate">{name}</span>
                <button
                  type="button"
                  aria-label={text.removePhoto(name)}
                  disabled={locked}
                  className="grid size-6 appearance-none place-items-center rounded-full border-0 bg-transparent text-muted-foreground hover:bg-secondary"
                  onClick={() => onChange({ kind: "extended", photos: value.photos.filter((photo) => photo !== name) })}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {value.photos.length < MAX_PHOTOS && !locked && (
          <span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-11 appearance-none items-center gap-2 rounded-xl border-2 border-dashed border-border bg-card px-4 text-sm font-bold text-foreground [font-family:inherit] hover:border-primary"
            >
              <Camera size={16} aria-hidden="true" />
              {text.addPhotos}
            </button>
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const names = Array.from(event.target.files ?? []).map((file) => file.name);
            onChange({ kind: "extended", photos: [...new Set([...value.photos, ...names])].slice(0, MAX_PHOTOS) });
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  return null;
}
