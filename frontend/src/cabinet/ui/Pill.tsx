import type { ReactNode } from "react";
import { Badge } from "@/shared/ui/kit/badge";
import type { Tone } from "../mocks/types";

const variants = {
  blue: "default",
  lime: "highlight",
  ok: "success",
  bad: "danger",
  warn: "warning",
  grey: "muted",
} as const;

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <Badge variant={variants[tone]}>{children}</Badge>;
}
