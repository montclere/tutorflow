export const SIGNUP_SECTION_ID = "signup";
export const SIGNUP_START_ID = "signup-start";
export const HERO_CTA_ID = "hero-cta";
export const FINAL_CTA_ID = "final-cta";

export function focusSignupStart() {
  document.getElementById(SIGNUP_START_ID)?.focus({ preventScroll: true });
}

export function scrollToSignup() {
  document.getElementById(SIGNUP_SECTION_ID)?.scrollIntoView({ block: "start" });
  window.history.replaceState(null, "", `#${SIGNUP_SECTION_ID}`);
}
