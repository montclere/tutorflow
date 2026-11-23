import { Check, ChevronDown, FileText, Image, Info, Loader2, Pencil, Save, Sparkles, Star, Undo2, X } from "lucide-react";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { gradeTask, returnAssignment, type Assignment } from "../../tasks/library";
import { aiReview, solutionOf, type AiReview } from "../../tasks/reviewAi";
import type { TaskItem } from "../../tasks/types";
import { Button } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { RichText } from "../../ui/RichText";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { clearReviewDraft, getReviewDraft, reviewDraftKey, subscribeReviewDrafts, updateReviewDraft } from "./model/reviewDraft";
import styles from "./review.module.css";

const text = cabinet.teacher.review;
const AI_DELAY_MS = 1100;

export function ExtendedReview({ assignment, task, index, auto }: { assignment: Assignment; task: TaskItem; index: number; auto?: ReactNode }) {
  const { notify } = useNotifier();
  const commentErrorId = useId();
  const last = assignment.attempts.at(-1);
  const answer = last?.answers[task.id];
  const photos = answer?.kind === "extended" ? answer.photos : [];
  const solution = solutionOf(assignment.studentId, task.id, photos);
  const transcript = solution.lines.filter((line) => !line.startsWith("Фото: "));
  const key = reviewDraftKey(assignment.id, last?.finishedAt ?? 0, task.id);
  const { points, comment, ai } = useSyncExternalStore(subscribeReviewDrafts, () => getReviewDraft(key));
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tried, setTried] = useState(false);
  const mistake = ai.kind === "done" ? ai.review.mistake : undefined;
  const save = () => notify(text.grade.draftSaved);
  const runAi = () => {
    updateReviewDraft(key, { ai: { kind: "checking" } });
    setTimeout(() => {
      try { updateReviewDraft(key, { ai: { kind: "done", review: aiReview(assignment.studentId, task) } }); }
      catch { updateReviewDraft(key, { ai: { kind: "error" } }); }
    }, AI_DELAY_MS);
  };
  const applyAi = (review: AiReview) => {
    if (review.score >= 0) updateReviewDraft(key, { points: review.score, ...(!comment.trim() ? { comment: review.summary } : {}) });
  };
  const submit = () => {
    if (points === null) return;
    gradeTask(assignment.id, task.id, points, task.points, comment);
    clearReviewDraft(key);
    notify(text.grade.graded);
  };
  const rework = () => {
    setTried(true);
    if (!comment.trim()) return;
    returnAssignment(assignment.id, comment);
    clearReviewDraft(key);
    notify(text.grade.returned);
  };

  return <section className={styles.extended}>
    <div className={styles.assessment}>
      {auto}
      <div className={styles.humanGrade}>
        <Star aria-hidden="true" />
        <label><b>{text.grade.label}</b><Select value={points === null ? "unset" : String(points)} onValueChange={(value) => updateReviewDraft(key, { points: Number(value) })}>
          <SelectTrigger aria-label={text.grade.select}><SelectValue placeholder={text.grade.unset} /></SelectTrigger>
          <SelectContent><SelectItem value="unset" disabled>{text.grade.unset}</SelectItem>{Array.from({ length: task.points + 1 }, (_, value) => <SelectItem key={value} value={String(value)}>{text.grade.choice(value, task.points)}</SelectItem>)}</SelectContent>
        </Select></label>
        <Button size="sm" onClick={save}>{text.grade.save}</Button>
      </div>
    </div>
    <div className={styles.reviewScroll}>
    <div className={styles.taskPrompt}>
      <FileText aria-hidden="true" />
      <div><p className={styles.taskMeta}>{text.task.title(index, task.points)}</p><p className={styles.statement}><RichText parts={task.statement} /></p>
      {task.answer.kind === "extended" && <><button type="button" className={styles.textButton} aria-expanded={criteriaOpen} onClick={() => setCriteriaOpen((open) => !open)}>{text.task.criteria}<ChevronDown size={15} aria-hidden="true" /></button>{criteriaOpen && <p className={styles.criteria}>{task.answer.criteria}</p>}</>}
      </div>
    </div>
    <section className={styles.solution}>
      <header><b><Pencil size={18} aria-hidden="true" />{text.task.solution}</b><span><Image size={17} aria-hidden="true" />{text.task.photos(photos.length)}</span></header>
      {transcript.length > 0 ? <div className={styles.notebook}>{transcript.map((line, lineIndex) => <div key={`${line}-${lineIndex}`}>{lineIndex === mistake ? <mark>{line}</mark> : line}</div>)}</div> : <p className={styles.demoNote}>{text.task.noTranscript}</p>}
      <details className={styles.attachments}><summary>{text.task.photos(photos.length)}</summary><p className={styles.demoNote}>{text.task.demoTranscript}</p>{photos.map((photo, photoIndex) => /^(https?:|blob:)/.test(photo) ? <a key={photo} href={photo} target="_blank" rel="noreferrer">{text.task.attachment(photoIndex + 1)}</a> : <span key={photo}>{photo}</span>)}</details>
    </section>
    <section className={styles.ai} aria-busy={ai.kind === "checking"}>
      <header><h3><Sparkles size={22} aria-hidden="true" />{text.ai.title}</h3>{ai.kind === "done" && <button type="button" className={styles.textButton} aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>{text.ai.details}<ChevronDown size={15} aria-hidden="true" /></button>}<Button size="sm" variant="primary" icon={ai.kind === "checking" ? Loader2 : Sparkles} disabled={ai.kind === "checking"} onClick={runAi}>{ai.kind === "checking" ? text.ai.checking : text.ai.check}</Button></header>
      {ai.kind === "idle" && <p className={styles.aiEmpty}>{text.ai.idle}</p>}
      {ai.kind === "checking" && <p className={styles.aiEmpty} role="status">{text.ai.checking}</p>}
      {ai.kind === "error" && <p className={styles.aiEmpty} role="alert">{text.ai.error}</p>}
      {ai.kind === "done" && <>
        <div className={styles.aiResult}><button type="button" className={styles.suggestion} disabled={ai.review.score < 0} aria-label={text.ai.apply} title={text.ai.apply} onClick={() => applyAi(ai.review)}><Check aria-hidden="true" />{ai.review.score >= 0 ? text.ai.suggests(ai.review.score, ai.review.max) : text.ai.unsure}</button><div><b><Info size={17} aria-hidden="true" />{text.ai.recommendation}</b><p>{ai.review.summary}</p></div></div>
        {detailsOpen && <ul className={styles.aiChecks}>{ai.review.checks.map((check) => <li key={check.text}>{check.ok ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}{check.text}</li>)}</ul>}
      </>}
      <p className={styles.demoNote}>{text.ai.demo}</p>
    </section>
    <label className={styles.comment}><span>{text.grade.comment}</span><textarea aria-label={text.grade.comment} aria-describedby={tried && !comment.trim() ? commentErrorId : undefined} value={comment} rows={1} maxLength={1000} placeholder={text.grade.commentPlaceholder} aria-invalid={tried && !comment.trim()} onChange={(event) => updateReviewDraft(key, { comment: event.target.value })} />{tried && !comment.trim() && <span id={commentErrorId} className={styles.error} role="alert">{text.grade.reworkHint}</span>}</label>
    </div>
    <footer className={styles.actions}><Button icon={Undo2} onClick={rework}>{text.grade.returnWithoutGrade}</Button><Button icon={Save} onClick={save}>{text.grade.saveDraft}</Button><Button icon={Check} variant="primary" disabled={points === null} onClick={submit}>{text.grade.publish}</Button></footer>
  </section>;
}
