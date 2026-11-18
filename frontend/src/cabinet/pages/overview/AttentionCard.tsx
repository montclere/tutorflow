import { useState } from "react";
import { CircleCheck, X } from "lucide-react";
import { navigate } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import { cabinet } from "../../content/cabinet.ru";
import type { AttentionItem, AttentionKind } from "../../mocks/types";
import { attentionDestination } from "../../model/overview";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { AttentionIcon, ICON_SIZE } from "../../ui/Icon";
import { useNotifier } from "../../ui/Notifications";
import { RowList } from "../../ui/RowList";
import { studentsHref } from "../students/useStudentsUrl";

const text = cabinet.teacher.overview.attention;

const kindStyles: Record<AttentionKind, string> = {
  debt: "bg-[var(--cab-bad-soft)] text-[var(--color-error)]",
  package: "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]",
  review: "bg-[var(--cab-tone-sky)] text-primary",
  lesson: "bg-[var(--cab-tone-sky)] text-primary",
  inactive: "bg-secondary text-muted-foreground",
};

export function AttentionCard({ items }: { items: AttentionItem[] }) {
  const { notify } = useNotifier();
  // Скрытые и выполненные пункты; пока нет сервера, живут до перезагрузки (OVERVIEW-7).
  const [hidden, setHidden] = useState<AttentionKind[]>([]);
  const visible = items.filter((item) => !hidden.includes(item.kind)).slice(0, text.maxItems);

  const hide = (kind: AttentionKind) => setHidden((current) => [...current, kind]);

  const act = (item: AttentionItem) => {
    const destination = attentionDestination(item);
    if (!destination) return;
    if (destination.to === "review") return navigate(teacherRoutes.review);
    if (destination.to === "student") return navigate(studentsHref("active", destination.studentId));
    hide(item.kind);
    notify(text.lessonDone);
  };

  return (
    <Card
      title={text.title}
      action={<span className="font-[family-name:var(--font-display)] text-3xl leading-none font-black tabular-nums">{visible.length}</span>}
    >
      {visible.length === 0 ? (
        <p className="m-0 flex items-center justify-center gap-2 py-6 text-sm font-bold text-muted-foreground">
          <span className="grid size-8 place-items-center rounded-full bg-highlight text-highlight-foreground">
            <CircleCheck size={ICON_SIZE} aria-hidden="true" />
          </span>
          {text.empty}
        </p>
      ) : (
        <RowList>
          {visible.map((item) => (
            // Кнопки всегда справа от текста: текст сжимается, а не перескакивает под кнопку (OVERVIEW-7).
            <div key={item.kind} className="group flex items-center gap-3 py-3">
              <span className={cx("grid size-9.5 flex-none place-items-center rounded-xl", kindStyles[item.kind])}>
                <AttentionIcon kind={item.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <b className="block text-base font-extrabold">{item.title}</b>
                <span className="block text-sm font-semibold text-muted-foreground">{item.note}</span>
              </div>
              <Button size="sm" onClick={() => act(item)}>
                {text.actions[item.kind]}
              </Button>
              <button
                type="button"
                className="appearance-none border-0 bg-transparent [font:inherit] hidden size-8 flex-none place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:grid"
                aria-label={text.hide(item.title)}
                onClick={() => hide(item.kind)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </RowList>
      )}
    </Card>
  );
}
