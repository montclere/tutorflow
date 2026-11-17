import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { navigate } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import { cabinet } from "../../content/cabinet.ru";
import type { AttentionItem, AttentionKind } from "../../mocks/types";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { AttentionIcon, ICON_SIZE } from "../../ui/Icon";
import { ListRow } from "../../ui/ListRow";
import { useNotifier } from "../../ui/Notifications";
import { RowList } from "../../ui/RowList";

const text = cabinet.teacher.overview.attention;

const kindStyles: Record<AttentionKind, string> = {
  debt: "bg-[var(--cab-bad-soft)] text-[var(--color-error)]",
  package: "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]",
  review: "bg-[var(--cab-tone-sky)] text-primary",
  lesson: "bg-[var(--cab-tone-sky)] text-primary",
  inactive: "bg-secondary text-muted-foreground",
};

export function AttentionCard({ items }: { items: AttentionItem[] }) {
  const { notify, notifySoon } = useNotifier();
  const [done, setDone] = useState<AttentionKind[]>([]);
  const visible = items.filter((item) => !done.includes(item.kind)).slice(0, text.maxItems);

  const act = (kind: AttentionKind) => {
    if (kind === "review") return navigate(teacherRoutes.review);
    if (kind === "lesson") {
      setDone((current) => [...current, kind]);
      return notify(text.lessonDone);
    }
    return notifySoon(text.actions[kind]);
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
            <ListRow
              key={item.kind}
              large
              lead={
                <span className={cx("grid size-9.5 flex-none place-items-center rounded-xl", kindStyles[item.kind])}>
                  <AttentionIcon kind={item.kind} />
                </span>
              }
              title={item.title}
              note={item.note}
            >
              <Button size="sm" onClick={() => act(item.kind)}>
                {text.actions[item.kind]}
              </Button>
            </ListRow>
          ))}
        </RowList>
      )}
    </Card>
  );
}
