import styles from "./wizard.module.css";

export function FieldError({ id, message }: { id: string; message: string | null }) {
  return (
    <p id={id} className={styles.error}>
      {message}
    </p>
  );
}
