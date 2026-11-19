import { useEffect } from "react";
import { focusSignupStart, LOGIN_HASH, scrollToSignup } from "../features/signup/ui/signupStart";
import { useSignupWizard } from "../features/signup/ui/useSignupWizard";
import { AiAssistant } from "../sections/AiAssistant";
import { Benefits } from "../sections/Benefits";
import { Demo } from "../sections/Demo";
import { Features } from "../sections/Features";
import { Faq } from "../sections/Faq";
import { FinalCta } from "../sections/FinalCta";
import { Footer } from "../sections/Footer";
import { Header } from "../sections/Header";
import { Hero } from "../sections/Hero";
import { HowItWorks } from "../sections/HowItWorks";
import { MobileCta } from "../sections/MobileCta";
import { Pricing } from "../sections/Pricing";
import { RoleChooser } from "../sections/RoleChooser";
import { SignupSection } from "../sections/SignupSection";
import { Telegram } from "../sections/Telegram";
import { Testimonials } from "../sections/Testimonials";
import { Ticker } from "../sections/Ticker";
import styles from "./App.module.css";

export function App() {
  const signup = useSignupWizard();

  const openLogin = () => {
    signup.wizard.restart("login");
    scrollToSignup();
    requestAnimationFrame(focusSignupStart);
  };

  // Кабинет без сессии отправляет на /#login — сразу открываем форму входа; то же при смене якоря на странице.
  useEffect(() => {
    const openIfLogin = () => {
      if (window.location.hash === LOGIN_HASH) openLogin();
    };
    openIfLogin();
    window.addEventListener("hashchange", openIfLogin);
    return () => window.removeEventListener("hashchange", openIfLogin);
    // openLogin стабилен по смыслу: мастер создаётся один раз.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className={styles.page}>
        <div className={styles.frame}>
          <div className={styles.inner}>
            <Header onLogin={openLogin} />
          </div>
          <main>
            <div className={styles.inner}>
              <Hero />
            </div>
            <Ticker />
            <div className={styles.sheet}>
              <div className={`${styles.inner} ${styles.sheetInner}`}>
                <Benefits />
                <HowItWorks />
                <AiAssistant />
                <Features />
                <Demo />
                <Telegram />
                <Testimonials />
                <Pricing />
                <SignupSection {...signup} />
                <Faq />
                <FinalCta />
              </div>
            </div>
          </main>
        </div>
        <div className={`${styles.inner} ${styles.gutter}`}>
          <Footer />
        </div>
      </div>
      <MobileCta />
      <RoleChooser />
    </>
  );
}
