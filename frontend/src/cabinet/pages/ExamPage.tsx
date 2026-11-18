import { useState } from "react";
import { cabinet } from "../content/cabinet.ru";
import { getExam } from "../data";
import { formatTimer } from "../model/format";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ListRow } from "../ui/ListRow";
import { useNotifier } from "../ui/Notifications";
import { PageHead } from "../ui/PageHead";
import { Pill } from "../ui/Pill";
import { RowList } from "../ui/RowList";
import { RichText } from "../ui/RichText";
import ui from "../ui/ui.module.css";
import { useCountdown } from "./useCountdown";
import styles from "./pages.module.css";

const text = cabinet.student.exam;

export function ExamPage() {
  const { notify, notifySoon } = useNotifier();
  const data = getExam();
  const [started, setStarted] = useState(false);
  const { left, reset } = useCountdown(started, data.durationSeconds);

  const finish = () => {
    setStarted(false);
    reset();
    notify(text.finished);
  };

  if (!started) {
    return (
      <>
        <PageHead title={text.title} subtitle={text.subtitle} />
        <div className={`${ui.grid} ${ui.g2}`}>
          <Card title={data.title} subtitle={data.subtitle} action={<Pill tone="lime">{text.badge}</Pill>}>
            <RowList>
              {data.parts.map((part) => (
                <ListRow key={part.title} title={part.title} note={part.note} />
              ))}
            </RowList>
            <div className={styles.actions}>
              <Button variant="primary" onClick={() => setStarted(true)}>
                {text.start}
              </Button>
              <Button onClick={() => notifySoon(text.onPaper)}>{text.onPaper}</Button>
            </div>
          </Card>
          <Card title={text.historyTitle}>
            <RowList>
              {data.history.map((item) => (
                <ListRow key={item.title} title={item.title} note={item.date}>
                  <Pill tone={item.tone}>{item.score}</Pill>
                </ListRow>
              ))}
            </RowList>
          </Card>
        </div>
      </>
    );
  }

  const { current } = data;

  return (
    <>
      <PageHead title={text.runningTitle} subtitle={text.runningSubtitle} />
      <div className={styles.exam}>
        <section className={styles.qcard}>
          <div className={styles.qmeta}>
            <Pill tone="blue">{text.task(current.number, data.taskCount)}</Pill>
            <Pill tone="grey">{text.points(current.points)}</Pill>
          </div>
          <div className={styles.qtext}>
            <RichText parts={current.question} />
          </div>
          <div className={styles.answer}>
            <input inputMode="decimal" placeholder={cabinet.placeholders.answer} aria-label={text.answerLabel(current.number)} />
            <Button onClick={() => notify(text.saved)}>{text.save}</Button>
          </div>
          <div className={styles.examNav}>
            <Button onClick={() => notifySoon(text.back)}>{text.back}</Button>
            <Button variant="primary" onClick={() => notifySoon(text.forward)}>
              {text.forward}
            </Button>
          </div>
        </section>

        <Card className={ui.stack}>
          <div>
            <span className={ui.muted}>{text.left}</span>
            <div className={styles.timer} role="timer">
              {formatTimer(left)}
            </div>
          </div>
          <ol className={styles.nav19} aria-label={text.navLabel}>
            {Array.from({ length: data.taskCount }, (_, index) => {
              const number = index + 1;
              const state = number === current.number ? styles.cur : number <= text.doneUpTo ? styles.done : "";
              return (
                <li key={number} className={state} aria-current={number === current.number ? "step" : undefined}>
                  {number}
                </li>
              );
            })}
          </ol>
          <Button variant="lime" onClick={finish}>
            {text.finish}
          </Button>
        </Card>
      </div>
    </>
  );
}
