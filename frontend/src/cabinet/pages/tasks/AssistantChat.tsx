import { Bot, ChevronDown, Info, SendHorizontal, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { examsOf, subjects } from "../../tasks/catalog";
import { sendToAssistant, setParams, undoMessage, useChat, type ChatMessage } from "../../tasks/chatStore";
import { tasksText } from "../../tasks/tasks.ru";
import type { Difficulty, SubjectId } from "../../tasks/types";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";

const text = tasksText.chat;
const COUNTS = [3, 5, 8, 10, 15, 20];
const NO_EXAM = "none";
const ANY = "any";
const MAX_INPUT_ROWS = 6;

function ParamSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        size="sm"
        className="h-8 w-auto gap-1.5 rounded-full border-border bg-card px-3 text-xs font-bold shadow-none [&_svg]:size-3.5"
      >
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Message({ message, onShowDraft }: { message: ChatMessage; onShowDraft?: () => void }) {
  const { notify } = useNotifier();
  if (message.author === "me") {
    return (
      <div className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed font-semibold text-primary-foreground [overflow-wrap:anywhere]">
        {message.text}
      </div>
    );
  }
  return (
    <div className="flex max-w-[92%] gap-2.5 self-start">
      <span className="mt-0.5 grid size-7 flex-none place-items-center rounded-full bg-highlight text-highlight-foreground" aria-hidden="true">
        <Bot size={15} />
      </span>
      <div
        className={cx(
          "grid gap-2 rounded-2xl rounded-tl-md border px-4 py-3 text-sm leading-relaxed font-semibold [overflow-wrap:anywhere]",
          message.tone === "refused" ? "border-[var(--cab-warn-soft)] bg-[var(--cab-warn-soft)]" : "bg-card",
          message.undone && "opacity-60",
        )}
      >
        <p className="m-0">{message.text}</p>
        {message.tone === "draft" && (
          <div className="flex flex-wrap items-center gap-2">
            {message.delta !== undefined && message.delta > 0 && <span className="rounded-full bg-[var(--cab-ok-soft)] px-2 py-0.5 text-xs font-bold text-success tabular-nums">+{tasksText.count(message.delta)}</span>}
            {!message.undone && message.undo && (
              <button
                type="button"
                className="inline-flex appearance-none items-center gap-1 border-0 bg-transparent p-0 text-xs font-bold text-primary [font-family:inherit] hover:underline"
                onClick={() => {
                  undoMessage(message.id);
                  notify(text.undone);
                }}
              >
                <Undo2 size={13} aria-hidden="true" />
                {text.undo}
              </button>
            )}
            {onShowDraft && (
              <button type="button" className="appearance-none border-0 bg-transparent p-0 text-xs font-bold text-primary [font-family:inherit] hover:underline min-[1181px]:hidden" onClick={onShowDraft}>
                {text.showDraft}
              </button>
            )}
            {message.undone && <span className="text-xs font-bold text-muted-foreground">{text.undone}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Чат с ИИ-помощником: параметры чипами, ответы — карточками изменений черновика с «Отменить» (TASKS-3). */
export function AssistantChat({ onShowDraft }: { onShowDraft?: () => void }) {
  const { messages, params, thinking } = useChat();
  const [value, setValue] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const exams = examsOf(params.subject);

  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // Поле растёт по высоте до шести строк.
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    element.style.height = "auto";
    const line = parseFloat(getComputedStyle(element).lineHeight) || 20;
    element.style.height = `${Math.min(element.scrollHeight, line * MAX_INPUT_ROWS + 20)}px`;
  }, [value]);

  const send = (request: string) => {
    if (sendToAssistant(request)) setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(value);
    }
  };

  const changeSubject = (subject: string) => {
    const first = examsOf(subject as SubjectId)[0];
    setParams({ subject: subject as SubjectId, exam: first?.id ?? null });
  };

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border bg-card" aria-label={text.title}>
      <header className="grid shrink-0 gap-3 border-b p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <div className="grid">
              <h2 className="m-0 font-[family-name:var(--font-display)] text-base font-extrabold">{text.title}</h2>
              <p className="m-0 text-xs font-semibold text-muted-foreground">{text.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            aria-expanded={aboutOpen}
            aria-controls="assistant-about"
            onClick={() => setAboutOpen((open) => !open)}
            className="inline-flex shrink-0 appearance-none items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-bold whitespace-nowrap text-muted-foreground [font-family:inherit] hover:text-foreground"
          >
            <Info size={13} aria-hidden="true" />
            {text.abilitiesToggle}
            <ChevronDown size={13} className={cx("transition-transform", aboutOpen && "rotate-180")} aria-hidden="true" />
          </button>
        </div>
        {aboutOpen && (
          <div id="assistant-about" className="grid max-h-56 gap-3 overflow-y-auto rounded-xl bg-secondary/60 p-3.5 text-xs leading-relaxed font-semibold sm:grid-cols-2">
            <div className="grid gap-1">
              <b className="text-foreground">{text.abilitiesTitle}</b>
              <ul className="m-0 grid gap-1 pl-4">
                {text.abilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="grid gap-1">
              <b className="text-foreground">{text.limitsTitle}</b>
              <ul className="m-0 grid gap-1 pl-4 text-muted-foreground">
                {text.limits.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </header>

      <div ref={feed} role="log" aria-label={text.messagesLabel} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-secondary/30 p-5 [scrollbar-width:thin] max-[1180px]:min-h-56 max-[1180px]:max-h-[28rem]">
        {messages.length === 0 && (
          <div className="m-auto grid w-full max-w-md gap-3 text-center">
            <p className="m-0 font-[family-name:var(--font-display)] text-base font-extrabold">{text.emptyTitle}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {text.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => send(example)}
                  className="appearance-none rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm font-bold text-foreground [font-family:inherit] transition-colors hover:border-primary hover:text-primary"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <Message key={message.id} message={message} onShowDraft={onShowDraft} />
        ))}
        {thinking && (
          <div className="flex items-center gap-2.5 self-start text-sm font-semibold text-muted-foreground" role="status">
            <span className="grid size-7 place-items-center rounded-full bg-highlight text-highlight-foreground" aria-hidden="true">
              <Bot size={15} />
            </span>
            <span className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <span key={dot} className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${dot * 150}ms` }} />
              ))}
            </span>
            {text.thinking}
          </div>
        )}
      </div>

      <div className="grid shrink-0 gap-3 border-t p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={text.paramsLabel}>
          <ParamSelect label={text.params.subject} value={params.subject} options={subjects.map((subject) => ({ value: subject.id, label: subject.label }))} onChange={changeSubject} />
          <ParamSelect
            label={text.params.exam}
            value={params.exam ?? NO_EXAM}
            options={[...exams.map((exam) => ({ value: exam.id, label: exam.label })), { value: NO_EXAM, label: text.params.noExam }]}
            onChange={(exam) => setParams({ exam: exam === NO_EXAM ? null : exam })}
          />
          <ParamSelect
            label={text.params.difficulty}
            value={params.difficulty === null ? ANY : String(params.difficulty)}
            options={[{ value: ANY, label: text.params.anyDifficulty }, ...([1, 2, 3] as Difficulty[]).map((level) => ({ value: String(level), label: tasksText.difficulty[level] }))]}
            onChange={(level) => setParams({ difficulty: level === ANY ? null : (Number(level) as Difficulty) })}
          />
          <ParamSelect label={text.params.count} value={String(params.count)} options={COUNTS.map((count) => ({ value: String(count), label: text.countValue(count) }))} onChange={(count) => setParams({ count: Number(count) })} />
        </div>
        {messages.length > 0 && (
          <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            {text.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="shrink-0 appearance-none rounded-full border border-border bg-card px-3 py-1 text-xs font-bold whitespace-nowrap text-foreground [font-family:inherit] hover:border-primary hover:text-primary"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-end gap-2 rounded-2xl border border-input bg-card p-1.5 pl-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30"
          onSubmit={(event) => {
            event.preventDefault();
            send(value);
          }}
        >
          <textarea
            ref={input}
            rows={1}
            value={value}
            maxLength={500}
            placeholder={text.placeholder}
            aria-label={text.inputLabel}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            className="min-h-9 flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-5 font-semibold [font-family:inherit] outline-none placeholder:text-muted-foreground"
          />
          <Button variant="primary" type="submit" icon={SendHorizontal} disabled={thinking || value.trim() === ""} aria-label={text.send} className="h-9 rounded-xl px-3" />
        </form>
      </div>
    </section>
  );
}
