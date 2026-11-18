import { File, FileImage, FileText, Link2, Presentation, type LucideIcon } from "lucide-react";
import type { MaterialKind } from "../mocks/types";
import { cx } from "./cx";

const icons: Record<MaterialKind, LucideIcon> = { pdf: FileText, doc: FileText, slides: Presentation, image: FileImage, link: Link2, other: File };
const tones: Record<MaterialKind, string> = {
  pdf: "bg-[var(--cab-bad-soft)] text-destructive",
  doc: "bg-[var(--cab-tone-sky)] text-[var(--cab-tone-sky-strong)]",
  slides: "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]",
  image: "bg-[var(--cab-ok-soft)] text-success",
  link: "bg-accent text-accent-foreground",
  other: "bg-secondary text-muted-foreground",
};

export function MaterialIcon({ kind, small }: { kind: MaterialKind; small?: boolean }) {
  const Icon = icons[kind];
  return (
    <span className={cx("grid flex-none place-items-center rounded-xl", small ? "size-9" : "size-11", tones[kind])} aria-hidden="true">
      <Icon size={small ? 16 : 20} />
    </span>
  );
}
