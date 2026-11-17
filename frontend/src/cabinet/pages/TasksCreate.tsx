import { FileDown, Library, RefreshCw, Pencil, SendHorizontal, TrendingUp, X, Zap } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { cabinet } from "../content/cabinet.ru";
import { getTaskLab } from "../data";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { cx } from "../ui/cx";
import { useNotifier } from "../ui/Notifications";
import { Pill } from "../ui/Pill";
import { RichText } from "../ui/RichText";
import { TaskCard, ToolButton } from "../ui/TaskCard";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/kit/card";
import { Input } from "@/shared/ui/kit/input";
import { ScrollArea } from "@/shared/ui/kit/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { Separator } from "@/shared/ui/kit/separator";
import { AssignDialog } from "./AssignDialog";
import { useTaskChat } from "./useTaskChat";
import styles from "./pages.module.css";

const text = cabinet.teacher.tasks;
const actionIcons = [FileDown, Library, Zap];

export function TasksCreate() {
  const { notifySoon } = useNotifier();
  const lab = getTaskLab();
  const { messages, draft, setDraft, send } = useTaskChat();
  const [assigning, setAssigning] = useState(false);
  const feed = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (request: string) => {
    if (!send(request)) notifySoon(text.chat.empty);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(draft);
  };

  return (
    <div style={{ "--tasks-offset": "244px" } as React.CSSProperties} className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1181px]:h-[max(560px,calc(100vh-var(--tasks-offset)))] min-[1181px]:grid-cols-2">
      <Card className="min-h-0 gap-4">
        <CardHeader>
          <CardTitle>{text.chat.title}</CardTitle>
          <CardDescription>{text.chat.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
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
          <div
            ref={feed}
            role="log"
            aria-label={text.chat.messagesLabel}
            className="flex min-h-40 flex-col gap-2 overflow-y-auto p-4 [scrollbar-width:thin] min-[1181px]:flex-1 max-[1180px]:max-h-96"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={cx(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed font-semibold [overflow-wrap:anywhere]",
                  message.author === "me" ? "self-end rounded-br-md bg-primary text-primary-foreground" : "self-start rounded-bl-md bg-secondary",
                )}
              >
                {message.text}
              </div>
            ))}
          </div>
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] [&>button]:shrink-0 [&>button]:whitespace-nowrap">
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
        </CardContent>
      </Card>

      <Card className="min-h-0 gap-4">
        <CardHeader>
          <CardTitle>{lab.draft.title}</CardTitle>
          <CardDescription>{lab.draft.subtitle}</CardDescription>
          <CardAction>
            <Pill tone="lime">{text.draft.badge}</Pill>
          </CardAction>
        </CardHeader>
        <ScrollArea className="min-h-0 flex-1" aria-label={text.draft.scrollLabel}>
          <div className="grid gap-3 px-6 pb-1">
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
        </ScrollArea>
        <Separator />
        <div className="flex flex-wrap gap-2 px-6">
          <Button variant="primary" icon={SendHorizontal} onClick={() => setAssigning(true)}>
            {text.draft.assign}
          </Button>
          {text.draft.actions.map((label, index) => {
            const Icon = actionIcons[index];
            return (
              <Button key={label} icon={Icon} onClick={() => notifySoon(label)}>
                {label}
              </Button>
            );
          })}
        </div>
      </Card>
      <AssignDialog open={assigning} onOpenChange={setAssigning} draftTitle={lab.draft.title} />
    </div>
  );
}
