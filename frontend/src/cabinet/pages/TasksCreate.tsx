import { X } from "lucide-react";
import { useEffect, useRef, type FormEvent } from "react";
import { cabinet } from "../content/cabinet.ru";
import { getTaskLab } from "../data";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { useNotifier } from "../ui/Notifications";
import { Pill } from "../ui/Pill";
import { RichText } from "../ui/RichText";
import { TaskCard, ToolButton } from "../ui/TaskCard";
import ui from "../ui/ui.module.css";
import { useTaskChat } from "./useTaskChat";
import styles from "./pages.module.css";

const text = cabinet.teacher.tasks;

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
          {lab.params.map((param) => (
            <div key={param.label} className={styles.param}>
              <label htmlFor={`param-${param.label}`}>{param.label}</label>
              <select id={`param-${param.label}`}>
                {param.options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className={styles.msgs} ref={feed} role="log" aria-label={text.chat.messagesLabel}>
          {messages.map((message, index) => (
            <div key={index} className={`${styles.msg} ${message.author === "me" ? styles.msgMe : styles.msgAi}`}>
              {message.text}
            </div>
          ))}
        </div>
        <div className={ui.chips}>
          {lab.quickReplies.map((reply) => (
            <Chip key={reply} onClick={() => submit(reply)}>
              {reply}
            </Chip>
          ))}
        </div>
        <form className={styles.composer} onSubmit={onSubmit}>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={text.chat.placeholder} aria-label={text.chat.inputLabel} />
          <Button variant="primary" size="sm" type="submit">
            {text.chat.send}
          </Button>
        </form>
      </Card>

      <Card title={lab.draft.title} subtitle={lab.draft.subtitle} action={<Pill tone="lime">{text.draft.badge}</Pill>}>
        <div className={ui.stack}>
          {lab.draft.cards.map((card) => (
            <TaskCard
              key={card.badge}
              badge={<Pill tone="grey">{card.badge}</Pill>}
              tools={
                <>
                  <ToolButton onClick={() => notifySoon(text.draft.replace)}>{text.draft.replace}</ToolButton>
                  <ToolButton onClick={() => notifySoon(text.draft.harder)}>{text.draft.harder}</ToolButton>
                  <ToolButton onClick={() => notifySoon(text.draft.edit)}>{text.draft.edit}</ToolButton>
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
          <div className={ui.empty}>{text.draft.more(lab.draft.hiddenCards)}</div>
        </div>
        <div className={styles.actions}>
          {text.draft.actions.map((label, index) => (
            <Button key={label} variant={index === 0 ? "primary" : "default"} onClick={() => notifySoon(label)}>
              {label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
