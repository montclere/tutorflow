import { Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { getSchedule, getStudentDetails, markMaterialOpened } from "../../data";
import { useStudents } from "../../data/useStudents";
import { demoStudentId } from "../../mocks/student";
import type { MaterialKind } from "../../mocks/types";
import { formatShortDate } from "../../model/dates";
import { formatBytes } from "../../model/materials";
import { cabinet } from "../../content/cabinet.ru";
import { cx } from "../../ui/cx";
import { MaterialIcon } from "../../ui/MaterialIcon";
import { PageHead } from "../../ui/PageHead";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { chunky } from "./chunky";
import styles from "./learn.module.css";
import { learnText } from "./learn.ru";

const text = learnText.materials;
const kinds = cabinet.teacher.students.profile.materials.kinds;
const home = cabinet.student.home;
type Filter = "all" | MaterialKind;

/** «Материалы» ученика: всё, что прислал репетитор, с фильтром по типу; открытие отмечается (STUDENT-3). */
export function MaterialsPage() {
  useStudents();
  const { materials } = getStudentDetails(demoStudentId);
  const [filter, setFilter] = useState<Filter>("all");
  const present = [...new Set(materials.map((material) => material.kind))];
  const shown = filter === "all" ? materials : materials.filter((material) => material.kind === filter);
  const unread = materials.filter((material) => !material.openedAt).length;

  return (
    <>
      <PageHead title={text.title} subtitle={unread > 0 ? `${text.subtitle} · ${text.unread(unread)}` : text.subtitle} />
      {present.length > 1 && (
        <ToggleGroup type="single" spacing={1} value={filter} aria-label={text.filterLabel} className="mb-4 w-fit flex-wrap gap-1 rounded-2xl border-2 bg-card p-1" onValueChange={(value) => value && setFilter(value as Filter)}>
          {(["all", ...present] as Filter[]).map((id) => (
            <ToggleGroupItem key={id} value={id} className="h-8 rounded-xl px-3 text-sm font-bold data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
              {id === "all" ? text.all : kinds[id]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {shown.length === 0 ? (
        <p className="m-0 rounded-3xl border-2 border-dashed bg-card p-10 text-center text-sm font-semibold text-muted-foreground">{text.empty}</p>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 min-[821px]:grid-cols-2">
          {shown.map((material, index) => {
            const isLink = material.kind === "link";
            return (
              <li key={material.id} className={cx("grid content-between gap-4 rounded-3xl border-2 bg-card p-5", styles.rise)} style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}>
                <div className="flex items-start gap-4">
                  <MaterialIcon kind={material.kind} />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <b className="flex flex-wrap items-center gap-2 text-base font-extrabold">
                      {material.title}
                      {!material.openedAt && <span className="rounded-full bg-highlight px-2 py-0.5 text-xs font-extrabold text-highlight-foreground">{home.materialNew}</span>}
                    </b>
                    <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                      {[kinds[material.kind], material.sizeBytes ? formatBytes(material.sizeBytes) : null, home.materialSent(formatShortDate(material.sentAt))].filter(Boolean).join(" · ")}
                    </span>
                    {material.note && <p className="m-0 mt-1 rounded-xl bg-secondary/70 px-3 py-2 text-sm font-semibold">{material.note}</p>}
                  </div>
                </div>
                {material.url && (
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noreferrer"
                    download={isLink ? undefined : material.fileName}
                    onClick={() => markMaterialOpened(material.id, getSchedule().today)}
                    className={chunky(material.openedAt ? "ghost" : "primary", "w-fit no-underline")}
                  >
                    {isLink ? <ExternalLink size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                    {isLink ? home.open : home.download}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
