import { FileDown, Library, RefreshCw, Pencil, SendHorizontal, TrendingUp, X, Zap } from "lucide-react";
import { useEffect, useRef, type FormEvent } from "react";
import { cabinet } from "../content/cabinet.ru";
import { getTaskLab } from "../data";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { cx } from "../ui/cx";
import { useNotifier } from "../ui/Notifications";
import { Pill } from "../ui/Pill";
import { RichText } from "../ui/RichText";
import { TaskCard, ToolButton } from "../ui/TaskCard";
import { Input } from "@/shared/ui/kit/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { Separator } from "@/shared/ui/kit/separator";
import { useTaskChat } from "./useTaskChat";
import styles from "./pages.module.css";

const text = cabinet.teacher.tasks;
const actionIcons = [SendHorizontal, FileDown, Library, Zap];

export function TasksCreate() {
  const { notifySoon } = useNotifier();
  const lab = getTaskLab();
  const { messages, draft, setDraft, send } = useTaskChat();
  const feed = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight });
  }, [messages]);

  const submit = (request: string) => {
    if (!send(request)) notifySoon(text.chat.empty);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(draft);
  };

  return (
    <div className={styles.gen}>
      <Card title={text.chat.title} subtitle={text.chat.subtitle} className={styles.chat}>
        <div className={styles.params}>
          {lab.params.map((param) => {
            const id = `param-${param.label}`;
            return (
              <div key={param.label} className={styles.param}>
                <label htmlFor={id}>{param.label}</label>
                <Select defaultValue={param.options[0]}>
                  <SelectTrigger id={id} className="h-auto w-full min-w-0 justify-between border-0 bg-transparent p-0 text-sm font-extrabold shadow-none focus-visible:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {param.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
        <Separator />
        <div className={styles.msgs} ref={feed} role="log" aria-label={text.chat.messagesLabel}>
          {messages.map((message, index) => (
            <div key={index} className={cx(styles.msg, message.author === "me" ? styles.msgMe : styles.msgAi)}>
              {message.text}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {lab.quickReplies.map((reply) => (
            <Chip key={reply} onClick={() => submit(reply)}>
              {reply}
            </Chip>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={onSubmit}>
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={text.chat.placeholder}
            aria-label={text.chat.inputLabel}
            className="h-10 min-w-0 flex-1 bg-card"
          />
          <Button variant="primary" type="submit" icon={SendHorizontal} className="h-10">
            {text.chat.send}
          </Button>
        </form>
      </Card>

      <Card title={lab.draft.title} subtitle={lab.draft.subtitle} action={<Pill tone="lime">{text.draft.badge}</Pill>}>
        <div className="grid gap-3">
          {lab.draft.cards.map((card) => (
            <TaskCard
              key={card.badge}
              badge={<Pill tone="grey">{card.badge}</Pill>}
              tools={
                <>
                  <ToolButton icon={RefreshCw} onClick={() => notifySoon(text.draft.replace)}>
                    {text.draft.replace}
                  </ToolButton>
                  <ToolButton icon={TrendingUp} onClick={() => notifySoon(text.draft.harder)}>
                    {text.draft.harder}
                  </ToolButton>
                  <ToolButton icon={Pencil} onClick={() => notifySoon(text.draft.edit)}>
                    {text.draft.edit}
                  </ToolButton>
                  <ToolButton label={text.draft.remove} onClick={() => notifySoon(text.draft.remove)}>
                    <X size={14} aria-hidden="true" />
                  </ToolButton>
                </>
              }
              question={<RichText parts={card.question} />}
              answer={card.answer}
              source={card.source}
            />
          ))}
          <p className="m-0 text-center text-xs font-semibold text-muted-foreground tabular-nums">{text.draft.more(lab.draft.hiddenCards)}</p>
        </div>
        <Separator />
        <div className="flex flex-wrap gap-2">
          {text.draft.actions.map((label, index) => {
            const Icon = actionIcons[index];
            return (
              <Button key={label} variant={index === 0 ? "primary" : "default"} icon={Icon} onClick={() => notifySoon(label)}>
                {label}
              </Button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
