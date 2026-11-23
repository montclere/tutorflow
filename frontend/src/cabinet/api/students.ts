import { ApiError, request, requestAll } from "../../shared/api/client";

/** Ученики, приглашения и родительский доступ по docs/api/students.md. Поля переводятся в camelCase. */

export type CardStatus = "active" | "archived";
export type InvitationPurpose = "new_student_card_for_student" | "new_student_card_for_parent";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type CabinetRole = "student" | "parent";

export type TeacherCard = {
  id: string;
  name: string;
  subject: string | null;
  goal: string | null;
  note: string | null;
  /** Аккаунт ученика привязан — ученик принял приглашение сам. */
  hasStudentAccount: boolean;
  status: CardStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CabinetCard = {
  id: string;
  name: string;
  subject: string | null;
  goal: string | null;
  teacherName: string;
};

export type Invitation = {
  id: string;
  purpose: InvitationPurpose;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
};

export type ParentAccess = { id: string; parentName: string | null; status: "active" | "revoked" };

export type ParentApplicationStatus = "pending" | "awaiting_review" | "approved" | "rejected" | "revoked" | "expired";
export type ParentApplication = { id: string; status: ParentApplicationStatus; requesterName: string | null; expiresAt: string };
export type ParentDecision = "approve" | "reject" | "revoke";

export type CardEdit = { name?: string; subject?: string | null; goal?: string | null; note?: string | null };

type TeacherCardView = {
  student_card_id: string;
  student_card_name: string;
  student_account_id: string | null;
  subject: string | null;
  learning_goal: string | null;
  private_note: string | null;
  status: CardStatus;
  created_at: string;
  updated_at: string;
  version: number;
};
type CabinetCardView = { student_card_id: string; student_card_name: string; subject: string | null; learning_goal: string | null; teacher_display_name: string };
type InvitationView = { invitation_id: string; purpose: InvitationPurpose; status: InvitationStatus; created_at: string; expires_at: string };
type ParentAccessView = { parent_access_id: string; parent_display_name: string | null; status: "active" | "revoked" };
type ParentApplicationView = { application_id: string; status: ParentApplicationStatus; requester_display_name: string | null; expires_at: string };

const toTeacherCard = (view: TeacherCardView): TeacherCard => ({
  id: view.student_card_id,
  name: view.student_card_name,
  subject: view.subject,
  goal: view.learning_goal,
  note: view.private_note,
  hasStudentAccount: view.student_account_id !== null,
  status: view.status,
  createdAt: view.created_at,
  updatedAt: view.updated_at,
  version: view.version,
});

const toCabinetCard = (view: CabinetCardView): CabinetCard => ({
  id: view.student_card_id,
  name: view.student_card_name,
  subject: view.subject,
  goal: view.learning_goal,
  teacherName: view.teacher_display_name,
});

const toInvitation = (view: InvitationView): Invitation => ({
  id: view.invitation_id,
  purpose: view.purpose,
  status: view.status,
  createdAt: view.created_at,
  expiresAt: view.expires_at,
});

const toApplication = (view: ParentApplicationView): ParentApplication => ({
  id: view.application_id,
  status: view.status,
  requesterName: view.requester_display_name,
  expiresAt: view.expires_at,
});

const cardPath = (id: string) => `/teacher/student-cards/${encodeURIComponent(id)}`;

/** Ссылка-приглашение: секрет только во фрагменте, на сервер с переходом он не уходит. */
export function invitationUrl(token: string, kind: "invite" | "parent-invite" = "invite"): string {
  return `${window.location.origin}/${kind}#token=${encodeURIComponent(token)}`;
}

/** Секрет из адреса страницы приглашения. */
export function tokenFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, "")).get("token") || null;
}

/** Только изменённые поля; пустая строка у необязательного поля — очистка (null). */
export function editBody(card: TeacherCard, edit: CardEdit): Record<string, string | number | null> | null {
  const body: Record<string, string | number | null> = {};
  const clean = (value: string | null | undefined) => {
    const trimmed = value?.trim() ?? "";
    return trimmed === "" ? null : trimmed;
  };
  if (edit.name !== undefined && edit.name.trim() !== card.name) body.student_card_name = edit.name.trim();
  if (edit.subject !== undefined && clean(edit.subject) !== card.subject) body.subject = clean(edit.subject);
  if (edit.goal !== undefined && clean(edit.goal) !== card.goal) body.learning_goal = clean(edit.goal);
  // Заметку не обрезаем: переносы строк в ней — часть текста.
  if (edit.note !== undefined && (edit.note === "" ? null : edit.note) !== card.note) body.private_note = edit.note === "" ? null : edit.note;
  if (Object.keys(body).length === 0) return null;
  return { ...body, expected_version: card.version };
}

export const studentsApi = {
  cards: async (status: CardStatus) => (await requestAll<TeacherCardView>("/teacher/student-cards", { status })).map(toTeacherCard),

  card: async (id: string) => toTeacherCard(await request<TeacherCardView>(cardPath(id))),

  /** Без изменений запрос не отправляется — возвращается та же карточка. */
  edit: async (card: TeacherCard, edit: CardEdit) => {
    const body = editBody(card, edit);
    if (!body) return card;
    return toTeacherCard(await request<TeacherCardView>(cardPath(card.id), "PATCH", body));
  },

  archive: async (card: TeacherCard) => toTeacherCard(await request<TeacherCardView>(`${cardPath(card.id)}/archive`, "POST", { expected_version: card.version })),

  restore: async (card: TeacherCard) => toTeacherCard(await request<TeacherCardView>(`${cardPath(card.id)}/restore`, "POST", { expected_version: card.version })),

  invitations: async () => (await requestAll<InvitationView>("/teacher/invitations")).map(toInvitation),

  /** Секрет приходит один раз — сразу превращаем его в ссылку. */
  invite: async (purpose: InvitationPurpose) => {
    const created = await request<{ invitation: InvitationView; invitation_token: string }>("/teacher/invitations", "POST", { purpose });
    return { invitation: toInvitation(created.invitation), url: invitationUrl(created.invitation_token) };
  },

  revokeInvitation: async (id: string) => {
    await request(`/teacher/invitations/${encodeURIComponent(id)}`, "DELETE");
  },

  parentAccess: async (cardId: string) =>
    (await requestAll<ParentAccessView>(`${cardPath(cardId)}/parent-access`)).map((view) => ({ id: view.parent_access_id, parentName: view.parent_display_name, status: view.status }) satisfies ParentAccess),

  revokeParentAccess: async (id: string) => {
    await request(`/parent-access/${encodeURIComponent(id)}`, "DELETE");
  },

  parentApplications: async (cardId: string) => (await requestAll<ParentApplicationView>(`${cardPath(cardId)}/parent-applications`)).map(toApplication),

  inviteParentToCard: async (cardId: string) => {
    const created = await request<{ application: ParentApplicationView; invitation_token: string }>(`${cardPath(cardId)}/parent-applications`, "POST");
    return { application: toApplication(created.application), url: invitationUrl(created.invitation_token, "parent-invite") };
  },

  decideParent: async (applicationId: string, decision: ParentDecision) =>
    toApplication(await request<ParentApplicationView>(`/teacher/parent-applications/${encodeURIComponent(applicationId)}/${decision}`, "POST")),

  // Сторона получателя ссылки.
  preview: async (token: string) => {
    const view = await request<{ purpose: InvitationPurpose; expires_at: string }>("/invitations/preview", "POST", { invitation_token: token });
    return { purpose: view.purpose, expiresAt: view.expires_at };
  },

  /** Имя ребёнка передаётся только для родительской ссылки — для ученической поле запрещено. */
  accept: async (token: string, childName?: string) => {
    const body = childName === undefined ? { invitation_token: token } : { invitation_token: token, student_card_name: childName.trim() };
    const result = await request<{ purpose: InvitationPurpose; student_card_id: string }>("/invitations/accept", "POST", body);
    return { role: (result.purpose === "new_student_card_for_parent" ? "parent" : "student") as CabinetRole, cardId: result.student_card_id };
  },

  applyForParentAccess: async (token: string) => {
    await request("/parent-applications/apply", "POST", { invitation_token: token });
  },

  myCards: async (role: CabinetRole) => (await requestAll<CabinetCardView>(`/${role}/student-cards`)).map(toCabinetCard),

  myCard: async (role: CabinetRole, id: string) => toCabinetCard(await request<CabinetCardView>(`/${role}/student-cards/${encodeURIComponent(id)}`)),
};

export type StudentsApi = typeof studentsApi;

/** Стабильные коды ошибок, на которые интерфейс отвечает своим текстом. */
export type StudentsErrorCode =
  | "invitationUnavailable"
  | "alreadyAccepted"
  | "alreadyLinked"
  | "acceptConflict"
  | "openLessons"
  | "versionConflict"
  | "notFound"
  | "tooManyRequests"
  | "unauthenticated"
  | "validation"
  | "unavailable";

export function studentsErrorCode(error: unknown): StudentsErrorCode {
  if (!(error instanceof ApiError)) return "unavailable";
  switch (error.code) {
    case "invitation_unavailable":
      return "invitationUnavailable";
    case "invitation_already_accepted":
      return "alreadyAccepted";
    case "student_card_already_linked":
      return "alreadyLinked";
    case "invitation_acceptance_conflict":
      return "acceptConflict";
    case "student_card_has_open_lessons":
      return "openLessons";
    case "version_conflict":
    case "parent_application_conflict":
      return "versionConflict";
    case "resource_not_found":
      return "notFound";
    case "authentication_required":
      return "unauthenticated";
  }
  if (error.status === 404) return "notFound";
  if (error.status === 429) return "tooManyRequests";
  if (error.status === 422) return "validation";
  return "unavailable";
}
