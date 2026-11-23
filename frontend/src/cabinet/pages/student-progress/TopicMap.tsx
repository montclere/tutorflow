import { Layers } from "lucide-react";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";
import { navigate } from "../../../app/router";
import { studentRoutes } from "../../../config/routes";
import { filterProgressUnits, type ProgressFilter } from "../../model/studentProgressView";
import { growthShare } from "../../model/studentHome";
import type { StudentProgress } from "../../tasks/progress";
import { cx } from "../../ui/cx";
import { learnText } from "../learn/learn.ru";
import styles from "./student-progress.module.css";

const text = learnText.progress;
const filters: ProgressFilter[] = ["all", "weak", "medium", "mastered"];

export function TopicMap({ progress, trainable }: { progress: StudentProgress; trainable: ReadonlySet<number> }) {
  const [filter, setFilter] = useState<ProgressFilter>("all");
  const units = filterProgressUnits(progress.units, filter);
  const exam = progress.mode === "exam";
  return <section className={styles.card} aria-labelledby="progress-topic-map">
    <div className={styles.sectionHead}>
      <div className={styles.sectionTitle}><Layers size={25} aria-hidden="true" /><div><h2 id="progress-topic-map">{text.mapTitle[progress.mode]}</h2><p>{text.mapHint}</p></div></div>
      <ToggleGroup type="single" spacing={1} value={filter} aria-label={text.filtersLabel} className={styles.filters} onValueChange={value => value && setFilter(value as ProgressFilter)}>
        {filters.map(value => <ToggleGroupItem key={value} value={value} className={styles.filter}>{text.filters[value]}</ToggleGroupItem>)}
      </ToggleGroup>
    </div>
    {units.length > 0 ? <ul className={cx(styles.topicGrid, !exam && styles.topicNames)} aria-label={text.mapTitle[progress.mode]}>
      {units.map(unit => {
        const level = unit.level === null ? learnText.noData : learnText.levels[unit.level] ?? "";
        const label = text.cell(exam ? `№${unit.number} · ${unit.label}` : unit.label, level, unit.correct, unit.total);
        const enabled = exam && unit.number !== undefined && trainable.has(unit.number);
        return <li key={unit.key}><Tooltip><TooltipTrigger asChild><span className={styles.tileWrap}>
          <button type="button" className={styles.tile} data-level={unit.level ?? "unknown"} disabled={!enabled} aria-label={label} onClick={() => navigate(`${studentRoutes.trainer}?mode=number&number=${unit.number}`)}>
            <span className={styles.tileNumbers}><b>{exam ? unit.number : unit.label}</b><span>{unit.total > 0 ? `${growthShare(unit)}%` : "—"}</span></span>
            {exam && <span className={styles.topicName}>{unit.label}</span>}
            <span className={styles.track} aria-hidden="true"><span style={{ width: `${growthShare(unit)}%` }} /></span>
            <span className={styles.level}>{level}</span>
          </button>
        </span></TooltipTrigger><TooltipContent className={styles.tooltip}>{label}</TooltipContent></Tooltip></li>;
      })}
    </ul> : <div className={styles.empty} role="status"><p>{text.filteredEmpty}</p>{filter !== "all" && <button type="button" className={styles.textButton} onClick={() => setFilter("all")}>{text.showAll}</button>}</div>}
  </section>;
}
