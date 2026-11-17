import { Avatar as KitAvatar, AvatarFallback } from "@/shared/ui/kit/avatar";
import type { AvatarTone } from "../mocks/types";

export function Avatar({ initials, tone, muted }: { initials: string; tone: AvatarTone; muted?: boolean }) {
  return (
    <KitAvatar aria-hidden="true" className={muted ? "opacity-60" : undefined}>
      <AvatarFallback tone={tone}>{initials}</AvatarFallback>
    </KitAvatar>
  );
}
