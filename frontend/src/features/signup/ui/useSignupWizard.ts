import { useState, useSyncExternalStore } from "react";
import { routes } from "../../../config/routes";
import { landing } from "../../../content/landing.ru";
import { track } from "../../../shared/analytics/track";
import { authApi } from "../../auth/api";
import { detectTimezone } from "../model/timezone";
import { createSignupWizard } from "../model/wizard";

export function useSignupWizard() {
  const [wizard] = useState(() =>
    createSignupWizard({
      api: authApi,
      track,
      timezone: detectTimezone(landing.timezoneCities),
      openCabinet: () => window.location.assign(routes.teacherCabinet),
    }),
  );
  const state = useSyncExternalStore(wizard.subscribe, wizard.getState);
  return { wizard, state };
}

export type SignupWizardModel = ReturnType<typeof useSignupWizard>;
