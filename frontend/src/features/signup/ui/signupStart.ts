export const SIGNUP_SECTION_ID = "signup";
export const SIGNUP_START_ID = "signup-start";

export function focusSignupStart() {
  document.getElementById(SIGNUP_START_ID)?.focus({ preventScroll: true });
}

export function scrollToSignup() {
  document.getElementById(SIGNUP_SECTION_ID)?.scrollIntoView({ block: "start" });
  window.history.replaceState(null, "", `#${SIGNUP_SECTION_ID}`);
}
