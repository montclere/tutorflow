import { useId, type Ref } from "react";
import { PASSWORD_MAX } from "../model/validation";
import { FieldError } from "./FieldError";
import styles from "./wizard.module.css";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  create: boolean;
  hint?: string;
  error?: string | null;
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
};

/** Поле пароля: новый — autocomplete new-password и подсказка о длине, вход — current-password. */
export function PasswordField({ label, value, onChange, create, hint, error, inputRef, autoFocus }: Props) {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        className={styles.input}
        type="password"
        maxLength={PASSWORD_MAX}
        autoComplete={create ? "new-password" : "current-password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={[hint ? hintId : "", errorId].filter(Boolean).join(" ")}
        data-autofocus={autoFocus || undefined}
      />
      {hint && (
        <span id={hintId} className={styles.fieldHint}>
          {hint}
        </span>
      )}
      <FieldError id={errorId} message={error ?? null} />
    </div>
  );
}
