import type { SubjectId } from "./profile";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string) => emailPattern.test(email.trim());

export type ProfileErrors = {
  name?: "nameRequired";
  subjects?: "subjectsRequired";
};

export function validateProfile(profile: { name: string; subjects: readonly SubjectId[] }): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!profile.name.trim()) errors.name = "nameRequired";
  if (profile.subjects.length === 0) errors.subjects = "subjectsRequired";
  return errors;
}

export const hasErrors = (errors: ProfileErrors) => Object.keys(errors).length > 0;
