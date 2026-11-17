import { Progress } from "@/shared/ui/kit/progress";

type Props = { percent: number; tone?: "default" | "success" | "danger" | "warning"; label?: string };

export function ProgressBar({ percent, tone, label }: Props) {
  return <Progress value={percent} tone={tone} aria-label={label} aria-hidden={label ? undefined : true} />;
}
