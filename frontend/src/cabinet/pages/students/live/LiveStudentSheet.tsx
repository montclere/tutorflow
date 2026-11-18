import { Archive, ArchiveRestore } from "lucide-react";
import { useState } from "react";
import { studentsApi, studentsErrorCode, type TeacherCard } from "../../../api/students";
import { cabinet } from "../../../content/cabinet.ru";
import { Button } from "../../../ui/Button";
import { useNotifier } from "../../../ui/Notifications";
import { ScrollArea } from "@/shared/ui/kit/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/shared/ui/kit/sheet";
import { CardForm } from "./CardForm";
import { CardAvatar } from "./LiveStudentsTable";
import { ParentsSection } from "./ParentsSection";

const text = cabinet.teacher.live;

type Props = {
  card: TeacherCard | null;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  onChanged: (card: TeacherCard) => void;
};

export function LiveStudentSheet({ card, onClose, onCloseAutoFocus, onChanged }: Props) {
  const { notify } = useNotifier();
  const [busy, setBusy] = useState(false);

  /** После конфликта версий берём свежую карточку с сервера — форма пересоздастся по новой версии. */
  const refresh = async (id: string) => {
    try {
      onChanged(await studentsApi.card(id));
    } catch (error) {
      notify(text.errors[studentsErrorCode(error)]);
    }
  };

  const toggleArchive = async (target: TeacherCard) => {
    if (busy) return;
    setBusy(true);
    try {
      const archive = target.status === "active";
      const next = archive ? await studentsApi.archive(target) : await studentsApi.restore(target);
      onChanged(next);
      notify(archive ? text.sheet.archived(target.name) : text.sheet.restored(target.name));
    } catch (error) {
      const code = studentsErrorCode(error);
      notify(text.errors[code]);
      if (code === "versionConflict") await refresh(target.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={card !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-[600px]" onCloseAutoFocus={onCloseAutoFocus}>
        {card && (
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 p-5 sm:p-6">
              <div className="flex items-center gap-4 pr-10">
                <CardAvatar card={card} large />
                <div className="min-w-0">
                  <SheetTitle className="m-0 font-[family-name:var(--font-display)] text-2xl leading-tight font-black tracking-tight">{card.name}</SheetTitle>
                  <SheetDescription className="m-0 flex flex-wrap items-center gap-2 text-base font-semibold">
                    {text.sheet.subtitle(card.subject)}
                    {card.status === "archived" && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold">{text.sheet.archivedBadge}</span>}
                  </SheetDescription>
                </div>
              </div>

              <CardForm key={`${card.id}:${card.version}`} card={card} onSaved={onChanged} onConflict={() => void refresh(card.id)} />
              <ParentsSection key={card.id} card={card} />

              <span>
                <Button icon={card.status === "active" ? Archive : ArchiveRestore} disabled={busy} onClick={() => void toggleArchive(card)}>
                  {card.status === "active" ? text.sheet.archive : text.sheet.restore}
                </Button>
              </span>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
