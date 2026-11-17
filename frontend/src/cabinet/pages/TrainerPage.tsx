import { useRef, useState, type FormEvent } from "react";
import { navigate } from "../../app/router";
import { studentRoutes } from "../../config/routes";
import { cabinet } from "../content/cabinet.ru";
import { getProgress, getTrainer } from "../data";
import { nextDrill, startTrainer, submitAnswer } from "../model/trainer";
import { Button, LinkButton } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { NumberGrid } from "../ui/NumberGrid";
import { useNotifier } from "../ui/Notifications";
import { PageHead } from "../ui/PageHead";
import { Pill } from "../ui/Pill";
import { RichText } from "../ui/RichText";
import ui from "../ui/ui.module.css";
import styles from "./pages.module.css";

const text = cabinet.student.trainer;

export function TrainerPage() {
  const { notify, notifySoon } = useNotifier();
  const data = getTrainer();
  const levels = getProgress().levels;
  const [state, setState] = useState(() => startTrainer(data.solved));
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const drill = data.drills[state.index % data.drills.length];

  if (!drill) return null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next = submitAnswer(state, data.drills, value);
    if (!next) {
      setError(text.empty);
      return;
    }
    setError("");
    setState(next);
  };

  const onNext = () => {
    setState(nextDrill(state));
    setValue("");
    requestAnimationFrame(() => input.current?.focus());
  };

  return (
    <>
      <PageHead title={text.title} subtitle={text.subtitle} />
      <div className={styles.trainer}>
        <section className={styles.qcard}>
          <div className={styles.qmeta}>
            <Pill tone="blue">{`${text.exam} · №${drill.number}`}</Pill>
            <Pill tone="grey">{text.taskNumber(state.solved)}</Pill>
          </div>
          <div className={styles.qtext}>
            <RichText parts={drill.question} />
          </div>

          {state.phase === "question" ? (
            <>
              <form className={styles.answer} onSubmit={onSubmit}>
                <input
                  ref={input}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={cabinet.placeholders.answer}
                  aria-label={text.answerLabel}
                  aria-invalid={error ? true : undefined}
                />
                <Button variant="primary" type="submit">
                  {text.check}
                </Button>
              </form>
              <div className={styles.err} role="alert">
                {error}
              </div>
              <LinkButton onClick={() => notify(text.hintText(drill.hint))}>{text.hint}</LinkButton>
            </>
          ) : (
            <>
              <div className={`${styles.fb} ${state.phase === "correct" ? styles.fbOk : styles.fbBad}`} role="status">
                {state.phase === "correct" ? text.correct : text.wrong(drill.answer)}
                <p>{drill.solution}</p>
              </div>
              <div>
                <Button variant="primary" onClick={onNext}>
                  {text.next}
                </Button>
              </div>
            </>
          )}
        </section>

        <aside className={ui.stack}>
          <div className={styles.streak}>
            <span className={styles.streakBig}>{data.streak}</span>
            <div>
              <b>{text.streakDays}</b>
              <span>{text.today(state.solved, data.dailyGoal)}</span>
            </div>
          </div>
          <Card title={text.pickTitle} subtitle={text.pickSub}>
            <NumberGrid
              cells={data.numbers.map((item) => ({
                number: item.number,
                caption: item.topic.slice(0, 6),
                level: levels[item.number - 1],
                pressed: item.number === drill.number,
              }))}
              onPick={(number) => notifySoon(`${text.title} №${number}`)}
            />
            <div className={styles.legend}>
              {cabinet.levels.map((label, level) => (
                <Pill key={label} tone={(["bad", "warn", "lime", "ok"] as const)[level] ?? "grey"}>
                  {label}
                </Pill>
              ))}
            </div>
          </Card>
          <Card title={text.modesTitle}>
            <div className={ui.chips}>
              {text.modes.map((mode) => (
                <Chip key={mode.label} pressed={mode.pressed} onClick={mode.pressed ? undefined : () => notifySoon(mode.label)}>
                  {mode.label}
                </Chip>
              ))}
              <Chip onClick={() => navigate(studentRoutes.exam)}>{text.fullVariant}</Chip>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
