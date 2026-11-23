export const siteConfig = {
  brand: "TutorFlow",
  logo: { left: "TUTOR", right: "FLOW" },
  trialDays: 14,
  freeStudentsLimit: 3,
  proPriceRub: 690,
  consentVersion: "2026-11-17",
} as const;

/** Публичная айдентика лендинга; название и логотип внутри кабинета сохраняются. */
export const publicBrand = {
  name: "Тьютор",
} as const;
