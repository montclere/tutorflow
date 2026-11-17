import { Plus, Search, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getSchedule, getStudents } from "../../data";
import { countByStatus, filterStudents } from "../../model/students";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { useNotifier } from "../../ui/Notifications";
import { PageHead } from "../../ui/PageHead";
import { Tabs } from "../../ui/Tabs";
import { Input } from "@/shared/ui/kit/input";
import { Toggle } from "@/shared/ui/kit/toggle";
import { StudentCards, StudentsTable } from "./StudentsTable";
import { StudentSheet } from "./StudentSheet";
import { studentsHref, useStudentsUrl } from "./useStudentsUrl";

const text = cabinet.teacher.students;

export function StudentsPage() {
  const { notifySoon } = useNotifier();
  const { today } = getSchedule();
  const students = getStudents();
  const { status, studentId, go } = useStudentsUrl();
  const [query, setQuery] = useState("");
  const [debtorsOnly, setDebtorsOnly] = useState(false);

  const counts = countByStatus(students);
  const list = filterStudents(students, { status, query, debtorsOnly });
  const selected = students.find((student) => student.id === studentId) ?? null;

  const emptyState = () => {
    if (query.trim() !== "") return <EmptyState title={text.empty.search} />;
    if (debtorsOnly) return <EmptyState title={text.empty.debtors} />;
    if (status === "active") {
      return (
        <EmptyState
          title={text.empty.first.title}
          text={text.empty.first.text}
          action={
            <Button variant="primary" icon={Plus} onClick={() => notifySoon(text.invite)}>
              {text.empty.first.action}
            </Button>
          }
        />
      );
    }
    return <EmptyState title={status === "pause" ? text.empty.pause : text.empty.archive} />;
  };

  const restoreFocus = (event: Event) => {
    event.preventDefault();
    const buttons = document.querySelectorAll<HTMLElement>(`[data-student-button="${studentId}"]`);
    for (const button of buttons) {
      if (button.offsetParent !== null) {
        button.focus();
        return;
      }
    }
  };

  return (
    <>
      <PageHead
        title={text.title}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => notifySoon(text.invite)}>
            {text.invite}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label={text.tabsLabel}
          selectedId={status}
          items={text.statusTabs.map((tab) => ({ id: tab.id, label: text.tabLabel(tab.label, counts[tab.id]), href: studentsHref(tab.id) }))}
        />
        <div className="flex flex-wrap items-center gap-2 max-[520px]:w-full">
          <div className="relative min-w-0 max-[520px]:flex-1">
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
          <Toggle pressed={debtorsOnly} onPressedChange={setDebtorsOnly} className="h-9 border-border bg-card px-3.5">
            <TriangleAlert aria-hidden="true" />
            {text.debtors}
          </Toggle>
        </div>
      </div>

      {list.length === 0 ? (
        emptyState()
      ) : (
        <>
          <StudentsTable students={list} today={today} selectedId={studentId} onOpen={(id) => go({ studentId: id })} />
          <StudentCards students={list} today={today} selectedId={studentId} onOpen={(id) => go({ studentId: id })} />
        </>
      )}

      <StudentSheet student={selected} today={today} onClose={() => go({ studentId: null })} onCloseAutoFocus={restoreFocus} />
    </>
  );
}
