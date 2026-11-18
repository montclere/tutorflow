import { useCallback, useEffect, useState } from "react";
import { studentsApi, studentsErrorCode, type ParentAccess, type ParentApplication, type ParentDecision, type TeacherCard } from "../../../api/students";
import { cabinet } from "../../../content/cabinet.ru";
import { Button } from "../../../ui/Button";
import { useNotifier } from "../../../ui/Notifications";
import { StudentEmpty, StudentSection } from "../StudentSection";
import { LinkField } from "./LinkField";

const text = cabinet.teacher.live;
const parents = text.sheet.parents;

type Data = { access: ParentAccess[]; applications: ParentApplication[] };

const OPEN_APPLICATION: ParentApplication["status"][] = ["pending", "awaiting_review"];

/** Родительский доступ к карточке: кто видит, заявки и отзыв (docs/api/students.md). */
export function ParentsSection({ card }: { card: TeacherCard }) {
  const { notify } = useNotifier();
  const [data, setData] = useState<Data | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [access, applications] = await Promise.all([studentsApi.parentAccess(card.id), studentsApi.parentApplications(card.id)]);
      setData({ access, applications });
    } catch (error) {
      notify(text.errors[studentsErrorCode(error)]);
    }
  }, [card.id, notify]);

  useEffect(() => {
    // Списки доступа — внешний источник; состояние выставляется после ответа сервера.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const run = async (operation: () => Promise<unknown>, done?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
      if (done) notify(done);
    } catch (error) {
      notify(text.errors[studentsErrorCode(error)]);
    } finally {
      setBusy(false);
      await load();
    }
  };

  const revoke = (access: ParentAccess) => run(() => studentsApi.revokeParentAccess(access.id), parents.revoked);
  const decide = (application: ParentApplication, decision: ParentDecision) => run(() => studentsApi.decideParent(application.id, decision));
  const invite = () =>
    run(async () => {
      setLink((await studentsApi.inviteParentToCard(card.id)).url);
    });

  const applications = data?.applications.filter((application) => application.status !== "expired") ?? [];

  return (
    <StudentSection title={parents.title}>
      {data && data.access.length === 0 && <StudentEmpty text={parents.empty} />}
      {data && data.access.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0">
          {data.access.map((access) => (
            <li key={access.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3.5 py-2.5">
              <b className="text-base font-bold">{access.parentName || parents.unnamed}</b>
              {access.status === "active" ? (
                <Button size="sm" disabled={busy} onClick={() => void revoke(access)}>
                  {parents.revoke}
                </Button>
              ) : (
                <span className="text-sm font-bold text-muted-foreground">{parents.revoked}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {applications.length > 0 && (
        <div className="grid gap-2">
          <h4 className="m-0 text-sm font-bold text-muted-foreground">{parents.applicationsTitle}</h4>
          <ul className="m-0 grid list-none gap-2 p-0">
            {applications.map((application) => (
              <li key={application.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary/60 px-3.5 py-2.5">
                <span className="grid min-w-0 flex-1">
                  <b className="text-base font-bold">{application.requesterName || parents.unnamedApplication}</b>
                  <span className="text-sm font-semibold text-muted-foreground">{parents.applicationStatus[application.status]}</span>
                </span>
                {application.status === "awaiting_review" && (
                  <>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => void decide(application, "approve")}>
                      {parents.approve}
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => void decide(application, "reject")}>
                      {parents.reject}
                    </Button>
                  </>
                )}
                {OPEN_APPLICATION.includes(application.status) && (
                  <Button size="sm" disabled={busy} onClick={() => void decide(application, "revoke")}>
                    {parents.revokeLink}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* К карточке, созданной родителем, свой родитель уже подключён; второго зовут к карточке ученика. */}
      {card.hasStudentAccount && card.status === "active" && (
        <div className="grid gap-2">
          {link ? (
            <LinkField url={link} label={parents.linkLabel} />
          ) : (
            <>
              <p className="m-0 text-sm font-semibold text-muted-foreground">{parents.inviteHint}</p>
              <span>
                <Button disabled={busy} onClick={() => void invite()}>
                  {parents.invite}
                </Button>
              </span>
            </>
          )}
        </div>
      )}
    </StudentSection>
  );
}
