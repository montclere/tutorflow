import { focusSignupStart, scrollToSignup } from "../features/signup/ui/signupStart";
import { useSignupWizard } from "../features/signup/ui/useSignupWizard";
import { Features } from "../sections/Features";
import { Faq } from "../sections/Faq";
import { FinalCta } from "../sections/FinalCta";
import { Footer } from "../sections/Footer";
import { Header } from "../sections/Header";
import { Hero } from "../sections/Hero";
import { HowItWorks } from "../sections/HowItWorks";
import { MobileCta } from "../sections/MobileCta";
import { Pricing } from "../sections/Pricing";
import { SignupSection } from "../sections/SignupSection";
import { Telegram } from "../sections/Telegram";
import { Ticker } from "../sections/Ticker";
import styles from "./App.module.css";

export function App() {
  const signup = useSignupWizard();

  const openLogin = () => {
    signup.wizard.restart();
    scrollToSignup();
    requestAnimationFrame(focusSignupStart);
  };

  return (
    <>
      <div className={styles.page}>
        <div className={styles.frame}>
          <Header onLogin={openLogin} />
          <main>
            <Hero />
            <Ticker />
            <div className={styles.sheet}>
              <SignupSection {...signup} />
              <HowItWorks />
              <Features />
              <Telegram />
              <Pricing />
              <Faq />
              <FinalCta />
            </div>
          </main>
        </div>
        <Footer />
      </div>
      <MobileCta />
    </>
  );
}
