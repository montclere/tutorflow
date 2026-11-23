import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { backspaceTarget, enterDigits, pasteCode, type CodeChange, type CodeDigits } from "../model/codeInput";
import styles from "./wizard.module.css";

type CodeInputProps = {
  digits: CodeDigits;
  onChange: (digits: CodeDigits) => void;
  labelledBy: string;
  describedBy: string;
  invalid: boolean;
  digitLabel: (position: number) => string;
};

export function CodeInput({ digits, onChange, labelledBy, describedBy, invalid, digitLabel }: CodeInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const wasFilled = useRef(false);

  const focus = (index: number) => inputs.current[index]?.focus();

  const apply = (change: CodeChange | null) => {
    if (!change) return;
    onChange(change.digits);
    focus(change.focus);
  };

  // После неверного кода поля очищаются, и ввод начинается заново с первой цифры.
  useEffect(() => {
    const filled = digits.some(Boolean);
    if (wasFilled.current && !filled) focus(0);
    wasFilled.current = filled;
  }, [digits]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== "Backspace") return;
    const target = backspaceTarget(digits, index);
    if (target === null) return;
    event.preventDefault();
    focus(target);
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const change = pasteCode(digits, event.clipboardData.getData("text"));
    if (!change) return;
    event.preventDefault();
    apply(change);
  };

  return (
    <div className={styles.code} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          className={styles.codeDigit}
          value={digit}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={digitLabel(index + 1)}
          aria-invalid={invalid}
          data-autofocus={index === 0 ? true : undefined}
          onChange={(event) => apply(enterDigits(digits, index, event.target.value))}
          onKeyDown={(event) => onKeyDown(event, index)}
          onPaste={onPaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}
