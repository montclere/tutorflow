import { Download, ExternalLink } from "lucide-react";
import { cabinet } from "../content/cabinet.ru";
import { getSchedule, getStudentDetails, markMaterialOpened } from "../data";
import { useStudents } from "../data/useStudents";
import { demoStudentId } from "../mocks/student";
import { formatShortDate } from "../model/dates";
import { formatBytes } from "../model/materials";
import { Card } from "../ui/Card";
import { MaterialIcon } from "../ui/MaterialIcon";
import { Pill } from "../ui/Pill";

const text = cabinet.student.home;
const kinds = cabinet.teacher.students.profile.materials.kinds;

/** Материалы, которые прислал репетитор; открытие отмечается — репетитор видит «Открыт». */
export function StudentMaterials() {
  // Подписка: новый материал от репетитора появляется сразу.
  useStudents();
  const { materials } = getStudentDetails(demoStudentId);

  return (
    <Card title={text.materialsTitle} subtitle={text.materialsSub}>
      {materials.length === 0 ? (
        <p className="m-0 text-sm font-semibold text-muted-foreground">{text.materialsEmpty}</p>
      ) : (
        <ul className="m-0 grid list-none divide-y divide-border p-0">
          {materials.map((material) => {
            const isLink = material.kind === "link";
            return (
              <li key={material.id} className="flex flex-wrap items-center gap-3 py-3">
                <MaterialIcon kind={material.kind} />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <b className="flex items-center gap-2 text-base font-extrabold">
                    <span className="truncate">{material.title}</span>
                    {!material.openedAt && <Pill tone="lime">{text.materialNew}</Pill>}
                  </b>
                  <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                    {[kinds[material.kind], material.sizeBytes ? formatBytes(material.sizeBytes) : null, text.materialSent(formatShortDate(material.sentAt))].filter(Boolean).join(" · ")}
                  </span>
                  {material.note && <span className="text-sm font-semibold">{material.note}</span>}
                </div>
                {material.url && (
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noreferrer"
                    download={isLink ? undefined : material.fileName}
                    onClick={() => markMaterialOpened(material.id, getSchedule().today)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-bold text-primary-foreground no-underline hover:opacity-90"
                  >
                    {isLink ? <ExternalLink size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
                    {isLink ? text.open : text.download}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
