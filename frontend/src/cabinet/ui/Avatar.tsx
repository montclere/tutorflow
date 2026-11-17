import { Avatar as KitAvatar, AvatarFallback } from "@/shared/ui/kit/avatar";
import type { StudentColor } from "../mocks/types";

export function Avatar({ initials, color, muted }: { initials: string; color: StudentColor; muted?: boolean }) {
  return (
    <KitAvatar aria-hidden="true" className={muted ? "opacity-60" : undefined}>
      <AvatarFallback color={color}>{initials}</AvatarFallback>
    </KitAvatar>
  );
}
