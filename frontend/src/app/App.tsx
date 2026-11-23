import { useEffect } from "react";
import { focusSignupStart, LOGIN_HASH, scrollToSignup } from "../features/signup/ui/signupStart";
import { useSignupWizard } from "../features/signup/ui/useSignupWizard";
import { LandingPage } from "../landing/LandingPage";

export function App() {
  const signup = useSignupWizard();

  const openLogin = () => {
    signup.wizard.restart("login");
    scrollToSignup();
    requestAnimationFrame(focusSignupStart);
  };

  // Кабинет без сессии отправляет на /#login — сохраняем существующий переход к форме.
  useEffect(() => {
    const openIfLogin = () => {
      if (window.location.hash === LOGIN_HASH) openLogin();
    };
    openIfLogin();
    window.addEventListener("hashchange", openIfLogin);
    return () => window.removeEventListener("hashchange", openIfLogin);
    // Мастер создаётся один раз; обработчик сохраняет прежнюю семантику входа.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSignup = () => {
    signup.wizard.setMode("register");
    scrollToSignup();
    requestAnimationFrame(focusSignupStart);
  };

  return <LandingPage signup={signup} onLogin={openLogin} onSignup={openSignup} />;
}
