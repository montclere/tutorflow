import { Button } from "../../../shared/ui/Button";
import { track, type CtaPlace } from "../../../shared/analytics/track";
import { focusSignupStart, SIGNUP_SECTION_ID } from "./signupStart";

type SignupCtaProps = {
  place: CtaPlace;
  label: string;
  variant?: "lime" | "plain";
  className?: string;
};

export function SignupCta({ place, label, variant = "lime", className }: SignupCtaProps) {
  const onClick = () => {
    track("cta_click", { place });
    // Переход по якорю сбрасывает фокус, поэтому кнопку фокусируем уже после него.
    requestAnimationFrame(focusSignupStart);
  };
  if (variant === "plain") {
    return (
      <a className={className} href={`#${SIGNUP_SECTION_ID}`} onClick={onClick}>
        {label}
      </a>
    );
  }
  return (
    <Button variant="lime" className={className} href={`#${SIGNUP_SECTION_ID}`} onClick={onClick}>
      {label}
    </Button>
  );
}
