import { Link2 } from "lucide-react";
import type { Invitation } from "../../../api/students";
import { cabinet } from "../../../content/cabinet.ru";
import { formatInstantDate } from "../../../model/instant";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";

const text = cabinet.teacher.live.invitations;

const statusTone: Record<Invitation["status"], string> = {
  pending: "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]",
  accepted: "bg-[var(--cab-ok-soft)] text-success",
  revoked: "bg-secondary text-muted-foreground",
  expired: "bg-secondary text-muted-foreground",
};

type Props = { invitations: Invitation[]; timezone: string; busyId: string | null; onRevoke: (invitation: Invitation) => void };

/** Получателя список не показывает — его не знает и сервер до принятия (docs/api/students.md). */
export function InvitationsList({ invitations, timezone, busyId, onRevoke }: Props) {
  return (
    <ul className="m-0 grid list-none gap-2 p-0" aria-label={text.listLabel}>
      {invitations.map((invitation) => (
        <li key={invitation.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
          <span className="grid size-10 flex-none place-items-center rounded-xl bg-secondary text-muted-foreground" aria-hidden="true">
            <Link2 size={18} />
          </span>
          <div className="grid min-w-0 flex-1 gap-0.5">
            <b className="text-base font-extrabold">{text.purpose[invitation.purpose]}</b>
            <span className="text-sm font-semibold text-muted-foreground">
              {text.created(formatInstantDate(invitation.createdAt, timezone))}
              {invitation.status === "pending" && ` · ${text.expires(formatInstantDate(invitation.expiresAt, timezone))}`}
            </span>
          </div>
          <span className={cx("inline-flex rounded-full px-2.5 py-1 text-sm font-bold whitespace-nowrap", statusTone[invitation.status])}>{text.status[invitation.status]}</span>
          {invitation.status === "pending" && (
            <Button size="sm" disabled={busyId === invitation.id} onClick={() => onRevoke(invitation)}>
              {text.revoke}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
