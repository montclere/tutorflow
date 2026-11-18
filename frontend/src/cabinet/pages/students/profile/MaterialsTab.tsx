import { Download, ExternalLink, Trash2, Upload } from "lucide-react";
import { cabinet } from "../../../content/cabinet.ru";
import { getStudentDetails, removeMaterial } from "../../../data";
import type { Student, StudentMaterial } from "../../../mocks/types";
import { formatShortDate } from "../../../model/dates";
import { formatBytes } from "../../../model/materials";
import { Button, IconButton } from "../../../ui/Button";
import { useNotifier } from "../../../ui/Notifications";
import { Pill } from "../../../ui/Pill";
import { MaterialIcon } from "../../../ui/MaterialIcon";
import { Empty, Panel } from "./parts";

const text = cabinet.teacher.students.profile.materials;

export function materialMeta(material: StudentMaterial): string {
  return [text.kinds[material.kind], material.sizeBytes ? formatBytes(material.sizeBytes) : null, text.sent(formatShortDate(material.sentAt))].filter(Boolean).join(" · ");
}

export function MaterialRow({ material, onRemove }: { material: StudentMaterial; onRemove?: () => void }) {
  const isLink = material.kind === "link";
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <MaterialIcon kind={material.kind} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <b className="truncate text-base font-extrabold">{material.title}</b>
        <span className="text-sm font-semibold text-muted-foreground tabular-nums">{materialMeta(material)}</span>
        {material.note && <span className="text-sm font-semibold">{material.note}</span>}
      </div>
      <Pill tone={material.openedAt ? "ok" : "grey"}>{material.openedAt ? text.opened(formatShortDate(material.openedAt)) : text.notOpened}</Pill>
      {material.url && (
        <a
          href={material.url}
          target="_blank"
          rel="noreferrer"
          download={isLink ? undefined : material.fileName}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-bold text-foreground no-underline hover:bg-secondary"
        >
          {isLink ? <ExternalLink size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
          {isLink ? text.open : text.download}
        </a>
      )}
      {onRemove && <IconButton icon={Trash2} label={text.remove(material.title)} onClick={onRemove} />}
    </li>
  );
}

export function MaterialsTab({ student, onSend }: { student: Student; onSend: () => void }) {
  const { notify } = useNotifier();
  const { materials } = getStudentDetails(student.id);

  return (
    <Panel
      title={text.title}
      hint={text.hint}
      action={
        <Button variant="primary" size="sm" icon={Upload} onClick={onSend}>
          {text.send}
        </Button>
      }
    >
      {materials.length === 0 ? (
        <Empty>{text.empty}</Empty>
      ) : (
        <ul className="m-0 list-none divide-y divide-border p-0">
          {materials.map((material) => (
            <MaterialRow
              key={material.id}
              material={material}
              onRemove={() => {
                removeMaterial(material.id);
                notify(text.removed);
              }}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}
