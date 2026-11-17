import { Avatar as KitAvatar, AvatarFallback } from "@/shared/ui/kit/avatar";
import { cx } from "./cx";
import type { StudentColor } from "../mocks/types";

export function Avatar({ initials, color, muted, large }: { initials: string; color: StudentColor; muted?: boolean; large?: boolean }) {
  return (
    <KitAvatar aria-hidden="true" className={cx(muted && "opacity-60", large && "size-16 rounded-2xl")}>
      <AvatarFallback color={color} className={large ? "text-lg" : undefined}>
        {initials}
      </AvatarFallback>
    </KitAvatar>
  );
}
