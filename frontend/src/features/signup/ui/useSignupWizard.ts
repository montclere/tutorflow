import { useState, useSyncExternalStore } from "react";
import { routes } from "../../../config/routes";
import { landing } from "../../../content/landing.ru";
import { track } from "../../../shared/analytics/track";
import { authApi } from "../../auth/api";
import { detectTimezone } from "../model/timezone";
import { createSignupWizard, type CabinetKind } from "../model/wizard";

const cabinetPaths: Record<CabinetKind, string> = { teacher: routes.teacherCabinet, student: routes.studentCabinet, parent: routes.parentCabinet };

/** invitation — форма на странице приглашения (см. createSignupWizard). */
export function useSignupWizard(invitation?: { token?: string; onSignedIn: () => void }) {
  const [wizard] = useState(() =>
    createSignupWizard({
      api: authApi,
      track,
      timezone: detectTimezone(landing.timezoneCities),
      openCabinet: (cabinet) => window.location.assign(cabinetPaths[cabinet]),
      invitation,
    }),
  );
  const state = useSyncExternalStore(wizard.subscribe, wizard.getState);
  return { wizard, state };
}

export type SignupWizardModel = ReturnType<typeof useSignupWizard>;
