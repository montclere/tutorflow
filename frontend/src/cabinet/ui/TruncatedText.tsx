import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";
import { cx } from "./cx";

type Props = { text: string; className?: string };

export function TruncatedText({ text, className }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cx("block truncate", className)}>{text}</span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
