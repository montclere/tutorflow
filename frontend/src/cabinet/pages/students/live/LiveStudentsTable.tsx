import { ChevronRight } from "lucide-react";
import type { TeacherCard } from "../../../api/students";
import { cabinet } from "../../../content/cabinet.ru";
import { cardColor } from "../../../model/cardColor";
import { initialsOf } from "../../../model/newStudent";
import { Avatar } from "../../../ui/Avatar";
import { cx } from "../../../ui/cx";
import { TruncatedText } from "../../../ui/TruncatedText";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/kit/table";

const text = cabinet.teacher.live;

export function CardAvatar({ card, large }: { card: TeacherCard; large?: boolean }) {
  return <Avatar initials={initialsOf(card.name)} color={cardColor(card.id)} muted={card.status === "archived"} large={large} />;
}

function Linked({ card }: { card: TeacherCard }) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full px-2.5 py-1 text-sm font-bold whitespace-nowrap",
        card.hasStudentAccount ? "bg-[var(--cab-ok-soft)] text-success" : "bg-secondary text-muted-foreground",
      )}
    >
      {card.hasStudentAccount ? text.linked.student : text.linked.parent}
    </span>
  );
}

const muted = (value: string | null) => (value ? <TruncatedText text={value} className="text-base font-semibold" /> : <span className="text-base font-semibold text-muted-foreground">{text.notSet}</span>);

type Props = { cards: TeacherCard[]; selectedId: string | null; onOpen: (id: string) => void };

/** В таблице главное о карточке; правка, заметка и родители — в панели карточки (STUDENTS-1). */
export function LiveStudentsTable({ cards, selectedId, onOpen }: Props) {
  return (
    <div className="max-[520px]:hidden">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table aria-label={text.listLabel} className="text-base">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {text.columns.map((column) => (
                <TableHead key={column} className="h-11 px-4 text-xs font-bold tracking-wide text-muted-foreground uppercase first:pl-6">
                  {column}
                </TableHead>
              ))}
              <TableHead className="w-10 px-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map((card) => (
              <TableRow
                key={card.id}
                className="group cursor-pointer transition-colors duration-150 hover:bg-secondary/50 focus-within:bg-secondary data-[state=selected]:bg-accent motion-reduce:transition-none"
                data-state={card.id === selectedId ? "selected" : undefined}
                onClick={() => onOpen(card.id)}
              >
                <TableCell className="w-[32%] max-w-0 px-4 py-4 pl-6">
                  <div className="flex items-center gap-3.5">
                    <CardAvatar card={card} />
                    <button
                      type="button"
                      data-student-button={card.id}
                      aria-label={text.openCard(card.name)}
                      className="block max-w-full min-w-0 truncate rounded-sm border-0 bg-transparent p-0 text-left text-base font-extrabold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                    >
                      {card.name}
                    </button>
                  </div>
                </TableCell>
                <TableCell className="max-w-0 px-4 py-4">{muted(card.subject)}</TableCell>
                <TableCell className="w-[28%] max-w-0 px-4 py-4">{muted(card.goal)}</TableCell>
                <TableCell className="px-4 py-4">
                  <Linked card={card} />
                </TableCell>
                <TableCell className="px-4 py-4 pr-5">
                  <ChevronRight size={18} className="text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function LiveStudentCards({ cards, selectedId, onOpen }: Props) {
  return (
    <ul className="m-0 hidden list-none flex-col gap-2 p-0 max-[520px]:flex" aria-label={text.listLabel}>
      {cards.map((card) => (
        <li key={card.id}>
          <button
            type="button"
            data-student-button={card.id}
            aria-label={text.openCard(card.name)}
            onClick={() => onOpen(card.id)}
            className={cx(
              "flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:bg-secondary motion-reduce:transition-none",
              card.id === selectedId && "border-primary bg-accent",
            )}
          >
            <CardAvatar card={card} />
            <span className="grid min-w-0 flex-1 gap-1">
              <b className="truncate text-base font-extrabold">{card.name}</b>
              <span className="block truncate text-sm font-semibold text-muted-foreground">{[card.subject, card.goal].filter(Boolean).join(" · ") || text.notSet}</span>
              <span>
                <Linked card={card} />
              </span>
            </span>
            <ChevronRight size={18} className="flex-none text-muted-foreground" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
