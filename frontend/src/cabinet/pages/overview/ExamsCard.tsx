import { ArrowDown, ArrowUp } from "lucide-react";
import { navigate } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { ExamPrep } from "../../mocks/types";
import { Avatar } from "../../ui/Avatar";
import { LinkButton } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { ListRow } from "../../ui/ListRow";
import { Pill } from "../../ui/Pill";
import { ProgressBar } from "../../ui/ProgressBar";
import { RowList } from "../../ui/RowList";
import { Badge } from "@/shared/ui/kit/badge";

const text = cabinet.teacher.overview.exams;

function progressText(item: ExamPrep) {
  if (item.inactiveDays !== undefined) return text.inactive(item.inactiveDays);
  return text.progress(item.daysLeft, item.weakNumber ?? 0);
}

function TrendBadge({ readiness, delta }: Pick<ExamPrep, "readiness" | "delta">) {
  if (delta === 0) return <Pill tone="grey">{`${readiness}%`}</Pill>;
  const up = delta > 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <Badge variant={up ? "success" : "danger"} title={up ? text.trendUp : text.trendDown}>
      {readiness}%
      <Arrow aria-hidden="true" />
    </Badge>
  );
}

export function ExamsCard({ exams }: { exams: ExamPrep[] }) {
  return (
    <Card title={text.title} action={<LinkButton onClick={() => navigate(teacherRoutes.students)}>{cabinet.common.all}</LinkButton>}>
      <RowList>
        {exams.map((item) => {
          const student = getStudent(item.studentId);
          const name = text.name(student.name, item.exam);
          return (
            <ListRow
              key={item.studentId}
              lead={<Avatar initials={student.initials} color={student.color} />}
              title={name}
              note={
                <>
                  {progressText(item)}
                  <span className="mt-1.5 block">
                    <ProgressBar percent={item.readiness} tone={item.delta < 0 ? "danger" : "default"} label={text.readinessLabel(name)} />
                  </span>
                </>
              }
            >
              <TrendBadge readiness={item.readiness} delta={item.delta} />
            </ListRow>
          );
        })}
      </RowList>
    </Card>
  );
}
