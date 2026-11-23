import type { MaterialKind, StudentMaterial } from "../mocks/types";

export type StudentMaterialFilter = "all" | MaterialKind;
const baseFilters: StudentMaterialFilter[] = ["all", "pdf", "image", "link"];
const normalize = (value: string) => value.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");

/** STUDENT-MATERIALS-UI-2: локальные поиск и тип, без мутации материалов/отметок открытия. */
export function studentMaterialsView(materials: StudentMaterial[], filter: StudentMaterialFilter, query: string) {
  const search = normalize(query);
  const shown = materials.filter((material) => (filter === "all" || material.kind === filter) && (!search || [material.title, material.note, material.fileName].some((value) => value !== undefined && normalize(value).includes(search))));
  const extra: MaterialKind[] = ["doc", "slides", "other"];
  return {
    shown,
    featuredId: shown.find((material) => material.kind === "pdf")?.id ?? null,
    unread: materials.filter((material) => !material.openedAt).length,
    filters: [...baseFilters, ...extra.filter((kind) => materials.some((material) => material.kind === kind))],
  };
}
