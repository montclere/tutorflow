import { useCallback, useEffect, useState } from "react";
import { studentsApi, type Invitation, type TeacherCard } from "../../../api/students";

export type TeacherStudents = { active: TeacherCard[]; archived: TeacherCard[]; invitations: Invitation[] };

type State = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; data: TeacherStudents };

/** Карточку после правки, архива или возврата кладём в нужный список, не перезагружая всё. */
export function placeCard(data: TeacherStudents, card: TeacherCard): TeacherStudents {
  const active = data.active.filter((item) => item.id !== card.id);
  const archived = data.archived.filter((item) => item.id !== card.id);
  if (card.status === "active") active.unshift(card);
  else archived.unshift(card);
  return { ...data, active, archived };
}

export function useTeacherStudents() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const [active, archived, invitations] = await Promise.all([studentsApi.cards("active"), studentsApi.cards("archived"), studentsApi.invitations()]);
      setState({ kind: "ready", data: { active, archived, invitations } });
    } catch {
      setState((current) => (current.kind === "ready" ? current : { kind: "failed" }));
    }
  }, []);

  useEffect(() => {
    // Список — внешний источник; состояние выставляется после ответа сервера.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const retry = () => {
    setState({ kind: "loading" });
    void load();
  };

  const update = (change: (data: TeacherStudents) => TeacherStudents) => setState((current) => (current.kind === "ready" ? { kind: "ready", data: change(current.data) } : current));

  return { state, reload: load, retry, update };
}
