import { Download, ExternalLink, FolderOpen, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../../content/cabinet.ru";
import { getStudentDetails, removeMaterial } from "../../../data";
import type { Student, StudentMaterial } from "../../../mocks/types";
import { formatShortDate } from "../../../model/dates";
import { formatBytes } from "../../../model/materials";
import { Button, IconButton } from "../../../ui/Button";
import { useNotifier } from "../../../ui/Notifications";
import { Pill } from "../../../ui/Pill";
import { MaterialIcon } from "../../../ui/MaterialIcon";
import { RecordDeleteDialog } from "./RecordDialog";
import styles from "./profile-records.module.css";

const text = cabinet.teacher.students.profile.materials;

export function materialMeta(material: StudentMaterial): string {
  return [text.kinds[material.kind], material.sizeBytes ? formatBytes(material.sizeBytes) : null, text.sent(formatShortDate(material.sentAt))].filter(Boolean).join(" · ");
}

export function MaterialRow({ material, onRemove }: { material: StudentMaterial; onRemove?: () => void }) {
  const isLink = material.kind === "link";
  return <li className={styles.materialRow}>
    <MaterialIcon kind={material.kind} />
    <div className={styles.materialInfo}><b>{material.title}</b><span>{materialMeta(material)}</span>{material.note && <p>{material.note}</p>}</div>
    <div className={styles.materialActions}>
      <Pill tone={material.openedAt ? "ok" : "grey"}>{material.openedAt ? text.opened(formatShortDate(material.openedAt)) : text.notOpened}</Pill>
      {material.url && <a href={material.url} target="_blank" rel="noopener noreferrer" download={isLink ? undefined : material.fileName} className={styles.materialOpen}>{isLink ? <ExternalLink aria-hidden="true" /> : <Download aria-hidden="true" />}{isLink ? text.open : text.download}</a>}
      {onRemove && <IconButton icon={Trash2} label={text.remove(material.title)} onClick={onRemove} />}
    </div>
  </li>;
}

export function MaterialsTab({ student, onSend }: { student: Student; onSend: () => void }) {
  const { notify } = useNotifier();
  const { materials } = getStudentDetails(student.id);
  const [removing, setRemoving] = useState<StudentMaterial | null>(null);
  return <section className={styles.panel} aria-labelledby="student-materials-title">
    <header className={styles.panelHeader}><div className={styles.heading}><h3 id="student-materials-title">{text.title}</h3><p>{text.hint}</p></div><Button variant="primary" icon={Upload} onClick={onSend}>{text.send}</Button></header>
    {materials.length === 0 ? <div className={styles.empty}><FolderOpen aria-hidden="true" /><p>{text.emptyTitle}</p><span>{text.empty}</span><Button icon={Upload} onClick={onSend}>{text.send}</Button></div> : <ul className={styles.materialList}>{materials.map((material) => <MaterialRow key={material.id} material={material} onRemove={() => setRemoving(material)} />)}</ul>}
    <RecordDeleteDialog open={removing !== null} title={text.deleteTitle} description={removing ? text.deleteDescription(removing.title) : ""} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) { removeMaterial(removing.id); notify(text.removed); setRemoving(null); } }} />
  </section>;
}
