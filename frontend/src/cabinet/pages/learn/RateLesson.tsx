import { useState } from "react";
import type { Student } from "../../mocks/types";
import { formatDayMonth } from "../../model/dates";
import { addRating, isRated, useRatings, type Stars } from "../../model/ratings";
import { cx } from "../../ui/cx";
import { chunky } from "./chunky";
import styles from "./learn.module.css";
import { learnText } from "./learn.ru";

const text = learnText.home.rate;
const STARS: Stars[] = [1, 2, 3, 4, 5];

/**
 * Оценка последнего проведённого урока (VIBE-11): звёзды 1–5 и необязательный комментарий.
 * После отправки — благодарность; оценка уходит репетитору в «Оценку уроков».
 */
export function RateLesson({ student }: { student: Student }) {
  const ratings = useRatings();
  const lesson = student.recentLessons.find((item) => item.status === "done");
  const [stars, setStars] = useState<Stars | null>(null);
  const [hover, setHover] = useState<Stars | null>(null);
  const [comment, setComment] = useState("");
  if (!lesson) return null;
  const done = isRated(ratings, student.id, lesson.date);
  const saved = ratings.find((item) => item.studentId === student.id && item.date === lesson.date);
  const shown = hover ?? stars ?? saved?.stars ?? 0;

  const send = () => {
    if (!stars) return;
    addRating({ studentId: student.id, date: lesson.date, topic: lesson.topic, stars, comment: comment.trim() || undefined });
  };

  return (
    <section className={cx("grid content-start gap-3 rounded-3xl bg-[var(--vibe-peach)] p-5", styles.rise)} style={{ "--delay": "440ms" } as React.CSSProperties} aria-label={text.title}>
      <header className="grid gap-0.5">
        <h2 className="m-0 font-[family-name:var(--font-display)] text-base font-extrabold">{done ? text.thanks : text.title}</h2>
        <span className="text-sm font-semibold text-muted-foreground">{text.lesson(formatDayMonth(lesson.date), lesson.topic)}</span>
      </header>
      <div className="flex items-center gap-1" role={done ? undefined : "radiogroup"} aria-label={text.title} onMouseLeave={() => setHover(null)}>
        {STARS.map((value) =>
          done ? (
            <span key={value} className={cx("text-3xl leading-none", value > shown && "opacity-25 grayscale")} aria-hidden="true">
              ⭐
            </span>
          ) : (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={stars === value}
              aria-label={text.star(value)}
              onClick={() => setStars(value)}
              onMouseEnter={() => setHover(value)}
              onFocus={() => setHover(value)}
              onBlur={() => setHover(null)}
              className={cx(
                "grid size-11 appearance-none place-items-center rounded-xl border-0 bg-transparent p-0 text-3xl leading-none transition-transform hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none motion-reduce:transition-none",
                value > shown && "opacity-30 grayscale",
              )}
            >
              <span aria-hidden="true">⭐</span>
            </button>
          ),
        )}
        {shown > 0 && <span className="ml-2 text-sm font-extrabold">{text.labels[shown - 1]}</span>}
      </div>
      {done && saved?.comment && <p className="m-0 text-sm font-semibold">«{saved.comment}»</p>}
      {!done && stars && (
        <div className={cx("grid gap-2", styles.rise)}>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={text.comment}
            aria-label={text.commentLabel}
            rows={2}
            maxLength={300}
            className="w-full resize-none rounded-2xl border-2 border-transparent bg-card px-3 py-2 text-sm font-semibold [font-family:inherit] outline-none focus:border-primary"
          />
          <button type="button" className={chunky("primary", "justify-self-start")} onClick={send}>
            {text.send}
          </button>
        </div>
      )}
    </section>
  );
}
