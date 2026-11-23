import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearch } from "../app/router";
import { routes } from "../config/routes";
import { studentsApi, type CabinetCard, type CabinetRole } from "../cabinet/api/students";
import { initialsOf } from "../cabinet/model/newStudent";
import { cardColor } from "../cabinet/model/cardColor";
import { Avatar } from "../cabinet/ui/Avatar";
import { CabinetLink } from "../cabinet/ui/CabinetLink";
import { Button } from "../cabinet/ui/Button";
import { cardPath } from "./InvitePage";
import { Heading, Panel } from "./LearnerFrame";
import { learner } from "./learner.ru";
import { LearnerSchedule } from "./LearnerSchedule";

const text = learner.cards;

type Load<T> = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; value: T };

function useLoad<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<Load<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    // Новая загрузка при смене карточки или повторе; ответ сервера — внешний источник состояния.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: "loading" });
    load().then(
      (value) => !cancelled && setState({ kind: "ready", value }),
      () => !cancelled && setState({ kind: "failed" }),
    );
    return () => {
      cancelled = true;
    };
    // load пересоздаётся на каждый рендер; загрузку определяет key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return { state, retry: () => setAttempt((count) => count + 1) };
}

const Loading = () => (
  <p className="m-0 py-10 text-center text-sm font-bold text-muted-foreground" role="status">
    {learner.loading}
  </p>
);

function Facts({ card }: { card: CabinetCard }) {
  const rows = [
    { label: text.teacher, value: card.teacherName },
    { label: text.subject, value: card.subject },
    { label: text.goal, value: card.goal },
  ];
  return (
    <dl className="m-0 grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-x-6">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-sm font-bold text-muted-foreground">{row.label}</dt>
          <dd className="m-0 text-base font-semibold">{row.value || text.notSet}</dd>
        </div>
      ))}
    </dl>
  );
}

function CardDetail({ role, id }: { role: CabinetRole; id: string }) {
  const { state } = useLoad(() => studentsApi.myCard(role, id), `${role}:${id}`);
  const back = (
    <CabinetLink href={role === "parent" ? routes.parentCabinet : routes.studentCabinet} className="text-sm font-bold text-primary no-underline">
      {text.back}
    </CabinetLink>
  );
  if (state.kind === "loading") return <Loading />;
  if (state.kind === "failed") {
    return (
      <>
        {back}
        <p className="m-0 rounded-2xl border border-dashed bg-card p-6 text-base font-semibold" role="alert">
          {text.unavailable}
        </p>
      </>
    );
  }
  const card = state.value;
  return (
    <>
      {back}
      <div className="flex items-center gap-4">
        <Avatar initials={initialsOf(card.name)} color={cardColor(card.id)} large />
        <Heading title={card.name} />
      </div>
      <Panel>
        <Facts card={card} />
      </Panel>
      <p className="m-0 text-sm font-semibold text-muted-foreground">{text.soon}</p>
    </>
  );
}

function CardList({ role, timezone }: { role: CabinetRole; timezone: string }) {
  const { state, retry } = useLoad(() => studentsApi.myCards(role), role);
  return (
    <>
      <Heading title={role === "parent" ? text.parentTitle : text.studentTitle} />
      {state.kind === "loading" && <Loading />}
      {state.kind === "failed" && (
        <Panel>
          <p className="m-0 text-base font-semibold" role="alert">
            {learner.failed}
          </p>
          <span>
            <Button onClick={retry}>{learner.retry}</Button>
          </span>
        </Panel>
      )}
      {state.kind === "ready" && state.value.length === 0 && <p className="m-0 rounded-2xl border border-dashed bg-card p-6 text-base font-semibold text-muted-foreground">{text.empty}</p>}
      {state.kind === "ready" && state.value.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0" aria-label={text.listLabel}>
          {state.value.map((card) => (
            <li key={card.id}>
              <CabinetLink
                href={cardPath(role, card.id)}
                className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-foreground no-underline transition-colors hover:bg-secondary/50"
              >
                <Avatar initials={initialsOf(card.name)} color={cardColor(card.id)} />
                <span className="grid min-w-0 flex-1">
                  <b className="truncate text-base font-extrabold">{card.name}</b>
                  <span className="truncate text-sm font-semibold text-muted-foreground">{[card.subject, card.teacherName].filter(Boolean).join(" · ")}</span>
                </span>
                <ChevronRight size={18} className="flex-none text-muted-foreground" aria-hidden="true" />
              </CabinetLink>
            </li>
          ))}
        </ul>
      )}
      {state.kind === "ready" && state.value.length > 0 && <LearnerSchedule role={role} cards={state.value} timezone={timezone} />}
    </>
  );
}

/** Кабинет ученика или родителя: карточки у репетиторов; ?card= — одна карточка. */
export function MyCardsPage({ role, timezone }: { role: CabinetRole; timezone: string }) {
  const id = new URLSearchParams(useSearch()).get("card");
  return id ? <CardDetail role={role} id={id} /> : <CardList role={role} timezone={timezone} />;
}
