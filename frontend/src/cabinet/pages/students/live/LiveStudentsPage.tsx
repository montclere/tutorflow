import { Archive as PhArchive, CloudSlash as PhCloudSlash, EnvelopeSimple as PhEnvelopeSimple, MagnifyingGlass as PhMagnifyingGlass, UserPlus as PhUserPlus } from "@phosphor-icons/react";
import { Search, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { studentsApi, studentsErrorCode, type Invitation, type InvitationPurpose, type TeacherCard } from "../../../api/students";
import { cabinet } from "../../../content/cabinet.ru";
import { useSession } from "../../../session/SessionContext";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { useNotifier } from "../../../ui/Notifications";
import { StudentsHeading } from "../StudentsHeading";
import styles from "../students.module.css";
import { Tabs } from "../../../ui/Tabs";
import { Input } from "@/shared/ui/kit/input";
import { InvitationsList } from "./InvitationsList";
import { InviteDialog } from "./InviteDialog";
import { LiveStudentSheet } from "./LiveStudentSheet";
import { LiveStudentCards, LiveStudentsTable } from "./LiveStudentsTable";
import { liveStudentsHref, useLiveStudentsUrl, type LiveTab } from "./useLiveStudentsUrl";
import { placeCard, useTeacherStudents } from "./useTeacherStudents";

const text = cabinet.teacher.live;

export function matchesQuery(card: TeacherCard, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("ru");
  return needle === "" || card.name.toLocaleLowerCase("ru").includes(needle);
}

/** Ученики рабочей сборки: карточки появляются, когда приглашение принято (docs/api/students.md). */
export function LiveStudentsPage() {
  const { timezone } = useSession();
  const { notify } = useNotifier();
  const { state, reload, retry, update } = useTeacherStudents();
  const { tab, studentId, go } = useLiveStudentsUrl();
  const [inviting, setInviting] = useState<InvitationPurpose | null>(null);
  const [query, setQuery] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);

  const invite = (
    <>
      <Button variant="primary" icon={UserPlus} onClick={() => setInviting("new_student_card_for_student")}>
        {text.inviteStudent}
      </Button>
      <Button icon={Users} onClick={() => setInviting("new_student_card_for_parent")}>
        {text.inviteParent}
      </Button>
    </>
  );

  const restoreFocus = (event: Event) => {
    event.preventDefault();
    for (const button of document.querySelectorAll<HTMLElement>(`[data-student-button="${studentId}"]`)) {
      if (button.offsetParent !== null) {
        button.focus();
        return;
      }
    }
  };

  const onIssued = (invitation: Invitation) => update((data) => ({ ...data, invitations: [invitation, ...data.invitations] }));

  const revoke = async (invitation: Invitation) => {
    setRevoking(invitation.id);
    try {
      await studentsApi.revokeInvitation(invitation.id);
      notify(text.invitations.revoked);
    } catch (error) {
      notify(text.errors[studentsErrorCode(error)]);
    } finally {
      setRevoking(null);
      await reload();
    }
  };

  const body = () => {
    if (state.kind === "loading") {
      return (
        <p className="m-0 py-10 text-center text-sm font-bold text-muted-foreground" role="status">
          {text.loading}
        </p>
      );
    }
    if (state.kind === "failed") return <EmptyState icon={PhCloudSlash} title={text.failed} action={<Button onClick={retry}>{text.retry}</Button>} />;

    const { data } = state;
    if (tab === "invitations") {
      return data.invitations.length === 0 ? (
        <EmptyState icon={PhEnvelopeSimple} title={text.empty.invitations} />
      ) : (
        <InvitationsList invitations={data.invitations} timezone={timezone} busyId={revoking} onRevoke={(invitation) => void revoke(invitation)} />
      );
    }

    const cards = data[tab].filter((card) => matchesQuery(card, query));
    if (cards.length === 0) {
      if (query.trim() !== "") return <EmptyState icon={PhMagnifyingGlass} title={text.empty.search} />;
      if (tab === "archived") return <EmptyState icon={PhArchive} title={text.empty.archived} />;
      return <EmptyState icon={PhUserPlus} title={text.empty.first.title} text={text.empty.first.text} action={<div className="flex flex-wrap justify-center gap-2">{invite}</div>} />;
    }
    return (
      <>
        <LiveStudentsTable cards={cards} selectedId={studentId} onOpen={(id) => go({ studentId: id })} />
        <LiveStudentCards cards={cards} selectedId={studentId} onOpen={(id) => go({ studentId: id })} />
      </>
    );
  };

  const data = state.kind === "ready" ? state.data : null;
  const selected = data ? (data.active.find((card) => card.id === studentId) ?? data.archived.find((card) => card.id === studentId) ?? null) : null;
  const pending = data?.invitations.filter((invitation) => invitation.status === "pending").length ?? 0;
  const counts: Record<LiveTab, number> = { active: data?.active.length ?? 0, archived: data?.archived.length ?? 0, invitations: pending };

  return (
    <div className={styles.page}>
      <StudentsHeading title={text.title} actions={invite} />
      <div className={styles.toolbar}>
        <Tabs
          label={text.tabsLabel}
          selectedId={tab}
          items={(Object.keys(text.tabs) as LiveTab[]).map((id) => ({ id, label: text.tabs[id], count: counts[id], href: liveStudentsHref(id) }))}
        />
        {tab !== "invitations" && (
          <div className="relative min-w-0 max-[520px]:w-full">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.searchPlaceholder}
              aria-label={text.searchLabel}
              className="h-9 w-60 bg-card pl-9 max-[520px]:w-full"
            />
          </div>
        )}
      </div>

      {body()}

      <LiveStudentSheet card={selected} onClose={() => go({ studentId: null })} onCloseAutoFocus={restoreFocus} onChanged={(card) => update((current) => placeCard(current, card))} />
      <InviteDialog purpose={inviting} onClose={() => setInviting(null)} onIssued={onIssued} />
    </div>
  );
}
