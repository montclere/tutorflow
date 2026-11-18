import { routes } from "../config/routes";

export type LegalDoc = "offer" | "privacy";

export function legalDocOf(pathname: string): LegalDoc | null {
  if (pathname === routes.offer) return "offer";
  if (pathname === routes.privacy) return "privacy";
  return null;
}
