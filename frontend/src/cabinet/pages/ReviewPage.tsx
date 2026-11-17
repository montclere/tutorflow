import { useState } from "react";
import { cabinet } from "../content/cabinet.ru";
import { getReview, getStudent } from "../data";
import { nextReviewIndex } from "../model/reviewQueue";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { useNotifier } from "../ui/Notifications";
import { PageHead } from "../ui/PageHead";
import { Pill } from "../ui/Pill";
import styles from "./pages.module.css";

const text = cabinet.teacher.review;

export function ReviewPage() {
  const { notify, notifySoon } = useNotifier();
  const { queue, solution } = getReview();
  const [index, setIndex] = useState(0);
  const item = queue[index];

  if (!item) return null;
  const student = getStudent(item.studentId);

  const advance = (message: string) => {
    notify(message);
    setIndex(nextReviewIndex(index, queue.length));
  };

  return (
    <>
      <PageHead title={text.title} subtitle={text.subtitle} />
      <div className={styles.review}>
        <Card compact>
          <div role="group" aria-label={text.queueLabel}>
            {queue.map((entry, entryIndex) => {
              const owner = getStudent(entry.studentId);
              return (
                <button key={entry.title} type="button" className={styles.qitem} aria-pressed={entryIndex === index} onClick={() => setIndex(entryIndex)}>
                  <Avatar initials={owner.initials} tone={owner.tone} />
                  <span>
                    <b>{owner.name}</b>
                    <small>{entry.title}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title={student.name} subtitle={`${item.title} · ${item.when}`} action={<Pill tone="grey">{text.photo}</Pill>}>
          <div className={styles.photo}>
            {solution.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
            <mark>{solution.mistake}</mark>
          </div>
          <div className={styles.aibox}>
            <b>{text.aiSuggests(item.aiScore)}</b>
            <p>{item.note}</p>
          </div>
          <div className={styles.actions}>
            <Button variant="primary" onClick={() => advance(text.accepted)}>
              {text.accept(item.aiScore)}
            </Button>
            <Button onClick={() => notifySoon(text.change)}>{text.change}</Button>
            <Button onClick={() => advance(text.reworked)}>{text.rework}</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
