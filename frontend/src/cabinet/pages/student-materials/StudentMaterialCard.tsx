import { BookOpen, Download, ExternalLink } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import { getSchedule, markMaterialOpened } from "../../data";
import type { StudentMaterial } from "../../mocks/types";
import { formatShortDate } from "../../model/dates";
import { formatBytes } from "../../model/materials";
import { cx } from "../../ui/cx";
import { MaterialIcon } from "../../ui/MaterialIcon";
import { learnText } from "../learn/learn.ru";
import styles from "./student-materials.module.css";

const text = learnText.materials;
const home = cabinet.student.home;
const kinds = cabinet.teacher.students.profile.materials.kinds;

export function StudentMaterialCard({ material, featured }: { material: StudentMaterial; featured: boolean }) {
  const isLink = material.kind === "link";
  const markOpened = () => markMaterialOpened(material.id, getSchedule().today);
  return <li className={cx(styles.card, featured && styles.featured)}>
    <article aria-label={material.title}>
      <div className={cx(styles.materialIcon, featured && styles.featuredIcon)}><MaterialIcon kind={material.kind} /></div>
      <div className={styles.content}>
        <span className={cx(styles.badge, !material.openedAt && styles.new)}>{material.openedAt ? text.opened(formatShortDate(material.openedAt)) : home.materialNew}</span>
        <h2>{material.title}</h2>
        <p className={styles.meta}>{[kinds[material.kind], material.sizeBytes !== undefined ? formatBytes(material.sizeBytes) : null, home.materialSent(formatShortDate(material.sentAt))].filter(Boolean).join(" · ")}</p>
        {material.note && <p className={styles.note}><BookOpen size={20} aria-hidden="true" /><span>{material.note}</span></p>}
      </div>
      <div className={styles.actions}>
        {material.url ? <>
          <a className={cx(styles.open, featured && styles.primary)} href={material.url} target="_blank" rel="noreferrer" onClick={markOpened}><ExternalLink size={19} aria-hidden="true" />{home.open}</a>
          {!isLink && <a className={styles.download} href={material.url} download={material.fileName} target="_blank" rel="noreferrer" onClick={markOpened} aria-label={text.downloadLabel(material.title)} title={home.download}><Download size={19} aria-hidden="true" /></a>}
        </> : <>
          <button type="button" className={cx(styles.open, featured && styles.primary)} disabled title={isLink ? text.noLink : text.noFile}><ExternalLink size={19} aria-hidden="true" />{home.open}</button>
          <span className={styles.unavailable}>{isLink ? text.noLink : text.noFile}</span>
        </>}
      </div>
    </article>
  </li>;
}
