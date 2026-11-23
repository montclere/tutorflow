import { useEffect, useState, type FormEvent } from "react";
import { navigate } from "../app/router";
import { routes } from "../config/routes";
import { authApi } from "../features/auth/api";
import { SignupWizard } from "../features/signup/ui/SignupWizard";
import { useSignupWizard } from "../features/signup/ui/useSignupWizard";
import { studentsApi, studentsErrorCode, tokenFromHash, type InvitationPurpose } from "../cabinet/api/students";
import { formatInstant } from "../cabinet/model/instant";
import { Button } from "../cabinet/ui/Button";
import { Input } from "@/shared/ui/kit/input";
import { Heading, Panel } from "./LearnerFrame";
import { learner } from "./learner.ru";
import type { AccountState } from "./useAccount";

const text = learner.invite;
const CHILD_NAME_MAX = 80;

type Preview = { kind: "loading" } | { kind: "unavailable" } | { kind: "ready"; purpose: InvitationPurpose; expiresAt: string };

const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function cardPath(role: "student" | "parent", cardId: string): string {
  return `${role === "parent" ? routes.parentCabinet : routes.studentCabinet}?card=${encodeURIComponent(cardId)}`;
}

/** Вход или регистрация прямо на странице ссылки; после них — снова к принятию. */
function InviteAuth({ token, onSignedIn }: { token?: string; onSignedIn: () => void }) {
  const model = useSignupWizard({ token, onSignedIn });
  return <SignupWizard {...model} />;
}

function Message({ error }: { error: string | null }) {
  return error ? (
    <p className="m-0 text-sm font-semibold text-destructive" role="alert">
      {error}
    </p>
  ) : null;
}

async function switchAccount(reload: () => Promise<void>) {
  try {
    await authApi.logout();
  } finally {
    await reload();
  }
}

function AcceptForm({ token, parent, name, reload }: { token: string; parent: boolean; name: string; reload: () => Promise<void> }) {
  const [childName, setChildName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (parent && childName.trim() === "") {
      setError(text.childNameRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await studentsApi.accept(token, parent ? childName : undefined);
      // replace: секрет из адреса уходит, «назад» не вернёт на погашенную ссылку.
      navigate(cardPath(result.role, result.cardId), { replace: true });
    } catch (caught) {
      setError(learner.errors[studentsErrorCode(caught)]);
      setBusy(false);
    }
  };

  return (
    <form className="grid gap-4" noValidate onSubmit={(event) => void submit(event)}>
      <p className="m-0 text-base font-semibold">{text.signedInAs(name)}</p>
      {parent && (
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">{text.childName}</span>
          <Input value={childName} maxLength={CHILD_NAME_MAX} placeholder={text.childNamePlaceholder} required onChange={(event) => setChildName(event.target.value)} />
        </label>
      )}
      <Message error={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {text.accept}
        </Button>
        <Button type="button" disabled={busy} onClick={() => void switchAccount(reload)}>
          {text.otherAccount}
        </Button>
      </div>
    </form>
  );
}

/** Ссылка-приглашение на новую карточку: /invite#token=… (docs/api/students.md). */
export function InvitePage({ account, reload }: { account: AccountState; reload: () => Promise<void> }) {
  const [token] = useState(() => tokenFromHash(window.location.hash));
  const [preview, setPreview] = useState<Preview>({ kind: "loading" });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    studentsApi.preview(token).then(
      (result) => !cancelled && setPreview({ kind: "ready", ...result }),
      () => !cancelled && setPreview({ kind: "unavailable" }),
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return <Heading title={text.unavailableTitle} text={text.missingText} />;
  if (preview.kind === "loading" || account.kind === "loading") {
    return (
      <p className="m-0 py-10 text-center text-sm font-bold text-muted-foreground" role="status">
        {learner.loading}
      </p>
    );
  }
  if (preview.kind === "unavailable") {
    return (
      <div role="alert">
        <Heading title={text.unavailableTitle} text={text.unavailableText} />
      </div>
    );
  }

  const parent = preview.purpose === "new_student_card_for_parent";
  const copy = parent ? text.parent : text.student;
  const timezone = account.kind === "ready" ? account.account.profile.timezone : browserTimezone();

  return (
    <>
      <Heading title={copy.title} text={copy.text} />
      <p className="m-0 text-sm font-bold text-muted-foreground">{text.expires(formatInstant(preview.expiresAt, timezone))}</p>
      {account.kind === "ready" ? (
        <Panel>
          <AcceptForm token={token} parent={parent} name={account.account.profile.displayName} reload={reload} />
        </Panel>
      ) : account.kind === "anonymous" ? (
        <InviteAuth token={token} onSignedIn={() => void reload()} />
      ) : (
        <Panel>
          <Message error={learner.failed} />
          <span>
            <Button onClick={() => void reload()}>{learner.retry}</Button>
          </span>
        </Panel>
      )}
    </>
  );
}

/** Ссылка родителя к уже существующей карточке: /parent-invite#token=… — заявку одобряет репетитор. */
export function ParentInvitePage({ account, reload }: { account: AccountState; reload: () => Promise<void> }) {
  const copy = learner.parentInvite;
  const [token] = useState(() => tokenFromHash(window.location.hash));
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) return <Heading title={text.unavailableTitle} text={text.missingText} />;
  if (account.kind === "loading") {
    return (
      <p className="m-0 py-10 text-center text-sm font-bold text-muted-foreground" role="status">
        {learner.loading}
      </p>
    );
  }
  if (sent) {
    return (
      <>
        <Heading title={copy.sentTitle} text={copy.sentText} />
        <span>
          <Button variant="primary" onClick={() => navigate(routes.parentCabinet, { replace: true })}>
            {copy.toCabinet}
          </Button>
        </span>
      </>
    );
  }

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      await studentsApi.applyForParentAccess(token);
      setSent(true);
    } catch (caught) {
      setError(learner.errors[studentsErrorCode(caught)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Heading title={copy.title} text={copy.text} />
      {account.kind === "ready" ? (
        <Panel>
          <p className="m-0 text-base font-semibold">{text.signedInAs(account.account.profile.displayName)}</p>
          <Message error={error} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy} onClick={() => void apply()}>
              {copy.apply}
            </Button>
            <Button disabled={busy} onClick={() => void switchAccount(reload)}>
              {text.otherAccount}
            </Button>
          </div>
        </Panel>
      ) : (
        // Регистрация здесь — обычная (без токена приглашения): ссылка ведёт к заявке, а не к новой карточке.
        <InviteAuth onSignedIn={() => void reload()} />
      )}
    </>
  );
}
