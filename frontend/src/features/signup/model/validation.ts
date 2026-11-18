import type { Contact, ContactType } from "../../auth/api";

// Пределы из docs/api/identity.md: пароль 15–128 символов, имя до 80, телефон в международном формате с «+».
export const PASSWORD_MIN = 15;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 80;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+[1-9][0-9]{7,14}$/;

export const isValidEmail = (email: string) => emailPattern.test(email.trim());

/** Телефон приводится к виду +79991234567: пробелы, скобки и дефисы убираются. */
export const normalizePhone = (phone: string) => phone.trim().replace(/[\s()-]/g, "");

export const isValidPhone = (phone: string) => phonePattern.test(normalizePhone(phone));

/** Контакт из поля ввода. type не задан — определяем по «@», как на входе по логину. */
export function toContact(raw: string, type?: ContactType): Contact {
  const kind = type ?? (raw.includes("@") ? "email" : "phone");
  return { type: kind, value: kind === "phone" ? normalizePhone(raw) : raw.trim() };
}

export function isValidContact(contact: Contact): boolean {
  return contact.type === "email" ? isValidEmail(contact.value) : isValidPhone(contact.value);
}

export type ProfileErrors = {
  name?: "nameRequired";
  password?: "passwordLength";
};

export function validatePassword(password: string): ProfileErrors["password"] {
  return password.length < PASSWORD_MIN || password.length > PASSWORD_MAX ? "passwordLength" : undefined;
}

export function validateProfile(profile: { name: string; password: string }): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!profile.name.trim()) errors.name = "nameRequired";
  const password = validatePassword(profile.password);
  if (password) errors.password = password;
  return errors;
}

export const hasErrors = (errors: ProfileErrors) => Object.values(errors).some(Boolean);
