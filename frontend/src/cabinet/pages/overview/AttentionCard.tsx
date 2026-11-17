import { useState } from "react";
import { navigate } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import { CircleCheck } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import type { AttentionItem, AttentionKind } from "../../mocks/types";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { AttentionIcon, ICON_SIZE } from "../../ui/Icon";
import { ListRow } from "../../ui/ListRow";
import { useNotifier } from "../../ui/Notifications";
import { Pill } from "../../ui/Pill";
import { RowList } from "../../ui/RowList";

const text = cabinet.teacher.overview.attention;

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
    <Card title={text.title} action={<Pill tone={visible.length ? "warn" : "ok"}>{visible.length}</Pill>}>
      {visible.length === 0 ? (
        <p className="m-0 flex items-center justify-center gap-2 py-6 text-sm font-bold text-muted-foreground">
          <CircleCheck size={ICON_SIZE} aria-hidden="true" />
          {text.empty}
        </p>
      ) : (
        <RowList>
          {visible.map((item) => (
            <ListRow
              key={item.kind}
              lead={
                <span className="grid size-9.5 flex-none place-items-center rounded-lg bg-secondary text-muted-foreground">
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
