import { UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { studentsApi, studentsErrorCode, type Invitation, type InvitationPurpose } from "../../../api/students";
import { cabinet } from "../../../content/cabinet.ru";
import { formatInstant } from "../../../model/instant";
import { useSession } from "../../../session/SessionContext";
import { Button } from "../../../ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { LinkField } from "./LinkField";

const text = cabinet.teacher.live;

type Issued = { kind: "creating" } | { kind: "failed"; message: string } | { kind: "ready"; invitation: Invitation; url: string };

type Props = { purpose: InvitationPurpose | null; onClose: () => void; onIssued: (invitation: Invitation) => void };

/** Ссылка создаётся сразу при открытии: секрет сервер выдаёт один раз (docs/api/students.md). */
export function InviteDialog({ purpose, onClose, onIssued }: Props) {
  const { timezone } = useSession();
  const [issued, setIssued] = useState<Issued>({ kind: "creating" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!purpose) return;
    let cancelled = false;
    // Новая ссылка на каждое открытие окна; ответ сервера — внешний источник состояния.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIssued({ kind: "creating" });
    studentsApi.invite(purpose).then(
      (result) => {
        if (cancelled) return;
        setIssued({ kind: "ready", ...result });
        onIssued(result.invitation);
      },
      (error: unknown) => {
        if (!cancelled) setIssued({ kind: "failed", message: text.errors[studentsErrorCode(error)] });
      },
    );
    return () => {
      cancelled = true;
    };
    // onIssued меняется на каждый рендер страницы — новая ссылка нужна только при новом открытии или повторе.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purpose, attempt]);

  const parent = purpose === "new_student_card_for_parent";

  return (
    <Dialog open={purpose !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <span className="grid size-12 place-items-center rounded-2xl bg-highlight text-highlight-foreground" aria-hidden="true">
            <UserPlus size={24} />
          </span>
          <DialogTitle className="font-[family-name:var(--font-display)] text-xl font-black">{parent ? text.invite.parentTitle : text.invite.studentTitle}</DialogTitle>
          <DialogDescription>{parent ? text.invite.parentText : text.invite.studentText}</DialogDescription>
        </DialogHeader>

        {issued.kind === "creating" && (
          <p className="m-0 py-4 text-sm font-bold text-muted-foreground" role="status">
            {text.invite.creating}
          </p>
        )}
        {issued.kind === "failed" && (
          <div className="grid gap-3">
            <p className="m-0 text-sm font-semibold text-destructive" role="alert">
              {issued.message}
            </p>
            <Button onClick={() => setAttempt((count) => count + 1)}>{text.invite.retry}</Button>
          </div>
        )}
        {issued.kind === "ready" && (
          <div className="grid gap-3">
            <LinkField url={issued.url} />
            <p className="m-0 text-sm font-semibold text-muted-foreground">
              {text.invite.expires(formatInstant(issued.invitation.expiresAt, timezone))}. {text.invite.once}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="primary" onClick={onClose}>
            {text.invite.done}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
