import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Separator } from "@/shared/ui/kit/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";

type Props = { badge: ReactNode; tools: ReactNode; question: ReactNode; answer?: string; source: string };

export function TaskCard({ badge, tools, question, answer, source }: Props) {
  return (
    <article className="grid min-w-0 gap-3 rounded-xl border bg-card p-4 transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-(--shadow-message) motion-reduce:transition-none">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {badge}
        <div className="flex flex-wrap gap-1.5">{tools}</div>
      </div>
      <div className="text-base leading-snug font-bold">{question}</div>
      {answer && <p className="m-0 w-fit rounded-md bg-secondary px-2 py-1 text-xs font-bold text-muted-foreground tabular-nums">{answer}</p>}
      <Separator />
      <p className="m-0 text-xs font-semibold text-muted-foreground">{source}</p>
    </article>
  );
}

type ToolProps = { label?: string; icon?: LucideIcon; onClick: () => void; children: ReactNode };

export function ToolButton({ label, icon: Icon, onClick, children }: ToolProps) {
  const button = (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-extrabold text-foreground transition-[border-color,color,background-color] duration-150 outline-none hover:border-primary hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 active:bg-accent motion-reduce:transition-none"
    >
      {Icon && <Icon size={13} aria-hidden="true" />}
      {children}
    </button>
  );

  if (!label) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
