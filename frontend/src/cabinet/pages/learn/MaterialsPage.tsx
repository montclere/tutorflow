import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { cabinet } from "../../content/cabinet.ru";
import { getStudentDetails } from "../../data";
import { useStudents } from "../../data/useStudents";
import { demoStudentId } from "../../mocks/student";
import { studentMaterialsView, type StudentMaterialFilter } from "../../model/studentMaterials";
import { StudentMaterialCard } from "../student-materials/StudentMaterialCard";
import styles from "../student-materials/student-materials.module.css";
import { learnText } from "./learn.ru";

const text = learnText.materials;
const kinds = cabinet.teacher.students.profile.materials.kinds;

/** STUDENT-MATERIALS-UI-1/2: материалы текущего ученика, прежняя отметка открытия. */
export function MaterialsPage() {
  useStudents();
  const { materials } = getStudentDetails(demoStudentId);
  const [filter, setFilter] = useState<StudentMaterialFilter>("all");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const view = studentMaterialsView(materials, filter, query);
  const featured = view.shown.find((material) => material.id === view.featuredId);
  const ordered = featured ? [featured, ...view.shown.filter((material) => material.id !== featured.id)] : view.shown;

  return <div className={styles.root}>
    <header className={styles.header}>
      <h1>{text.title}</h1>
      <picture className={styles.art}>
        <source srcSet="/student-materials/books-600.webp 600w, /student-materials/books.webp 1000w" sizes="(max-width: 1279px) 220px, 320px" type="image/webp" />
        <img src="/student-materials/books.webp" width="1000" height="667" alt="" decoding="async" />
      </picture>
    </header>
    <div className={styles.toolbar}>
      <div className={styles.filters}>
        <ToggleGroup type="single" spacing={1} value={filter} aria-label={text.filterLabel} className={styles.tabs} onValueChange={(value) => value && setFilter(value as StudentMaterialFilter)}>
          {view.filters.map((id) => <ToggleGroupItem key={id} value={id} className={styles.tab}>{id === "all" ? text.all : kinds[id]}</ToggleGroupItem>)}
        </ToggleGroup>
        <span className={styles.unread} role="status">{text.unread(view.unread)}</span>
      </div>
      <label className={styles.search}>
        <Search size={20} aria-hidden="true" />
        <input ref={searchRef} type="search" aria-label={text.search} placeholder={text.search} value={query} onChange={(event) => setQuery(event.target.value)} />
        {query && <button type="button" aria-label={text.clearSearch} title={text.clearSearch} onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={17} aria-hidden="true" /></button>}
      </label>
    </div>
    <p className={styles.srOnly} role="status">{text.results(view.shown.length)}</p>
    {ordered.length > 0 ? <ul className={styles.grid} aria-label={text.listLabel}>
      {ordered.map((material) => <StudentMaterialCard key={material.id} material={material} featured={material.id === view.featuredId} />)}
    </ul> : <section className={styles.empty}>
      <h2>{materials.length > 0 ? text.noResults : text.empty}</h2>
      <p>{materials.length > 0 ? text.noResultsNote : text.emptyNote}</p>
      {materials.length > 0 && <button type="button" className={styles.reset} onClick={() => { setFilter("all"); setQuery(""); searchRef.current?.focus(); }}>{text.reset}</button>}
    </section>}
  </div>;
}
