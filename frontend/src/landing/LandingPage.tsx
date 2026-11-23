import { ArrowRight, Check, Menu, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/shared/ui/kit/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/kit/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/kit/tabs";
import { env } from "../config/env";
import { routes } from "../config/routes";
import { landing } from "../content/landing.ru";
import { landingRedesign as text } from "../content/landing-redesign.ru";
import { FINAL_CTA_ID, HERO_CTA_ID, SIGNUP_SECTION_ID } from "../features/signup/ui/signupStart";
import { SignupWizard } from "../features/signup/ui/SignupWizard";
import type { SignupWizardModel } from "../features/signup/ui/useSignupWizard";
import { RoleChooser } from "../sections/RoleChooser";
import { BrandLogo } from "./BrandLogo";
import { track, type CtaPlace } from "../shared/analytics/track";
import styles from "./LandingPage.module.css";
type Props = {
  signup: SignupWizardModel;
  onLogin: () => void;
  onSignup: () => void;
};
type SignupAction = Pick<Props, "onSignup">;
const hasDemo = env.demo || Boolean(env.demoUrl);
const demoHref = (path = routes.teacherCabinet as string) => env.demoUrl ?? path;
const asset = (name: string) => `/landing/assets/fennec/${name}.svg`;
function SignupButton({
  onSignup,
  children = text.create,
  place = "hero",
  className = "",
  id
}: SignupAction & {
  children?: ReactNode;
  place?: CtaPlace;
  className?: string;
  id?: string;
}) {
  return <button type="button" id={id} className={`${styles.button} ${styles.primary} ${className}`} onClick={() => {
    track("cta_click", {
      place
    });
    onSignup();
  }}>
    {children}
  </button>;
}
function Brand() {
  return <BrandLogo className={styles.brand} />;
}
function Header({
  onLogin,
  onSignup
}: Omit<Props, "signup">) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className={styles.header}>
    <Brand />
    <nav className={styles.desktopNav} aria-label={text.navLabel}>
      {text.nav.map(item => <a key={item.href} href={item.href}>
        {item.label}
      </a>)}
    </nav>
    <div className={styles.headerActions}>
      <button className={`${styles.button} ${styles.outline} ${styles.login}`} type="button" onClick={onLogin}>
        {text.login}
      </button>
      <SignupButton onSignup={onSignup} className={styles.headerCta} />
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={styles.menuTrigger} aria-label={menuOpen ? text.closeMenu : text.menu}>
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={12} className={styles.mobileMenu} data-landing-theme="true">
          <nav aria-label={text.navLabel}>
            {text.nav.map(item => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>)}
            <button type="button" onClick={() => {
              setMenuOpen(false);
              onLogin();
            }}>
              {text.login}
            </button>
          </nav>
        </PopoverContent>
      </Popover>
    </div>
  </header>;
}
function Rays({
  className = ""
}: {
  className?: string;
}) {
  return <svg viewBox="0 0 90 75" className={`${styles.rays} ${className}`} fill="none" aria-hidden="true">
    <path d="m13 54 23 5M34 25l16 17M67 10l4 25" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
  </svg>;
}
function Hero({
  onSignup
}: SignupAction) {
  return <section className={styles.hero} aria-labelledby="hero-title">
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow}>
        {text.hero.eyebrow}
      </p>
      <h1 id="hero-title">
        {text.hero.lines.map((line, index) => <span key={line} className={index === 2 ? styles.underlined : undefined}>
          {line}
          {index === 2 && <svg viewBox="0 0 360 22" fill="none" preserveAspectRatio="none" aria-hidden="true">
            <path d="M4 12C94 1 237 1 351 8M65 15c103-8 192-10 276 2M192 16l80-11" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>}
        </span>)}
      </h1>
      <div className={styles.heroActions} id={HERO_CTA_ID}>
        <SignupButton onSignup={onSignup}>
          {text.hero.cta}
          <ArrowRight aria-hidden="true" />
        </SignupButton>
        <a className={`${styles.button} ${styles.outline}`} href={hasDemo ? demoHref() : "#demo"}>
          {text.hero.demo}
        </a>
      </div>
    </div>
    <div className={styles.mascotScene}>
      <div className={styles.mascotBlob} aria-hidden="true" />
      <Rays />
      <img className={styles.mascot} src="/landing/assets/fennec/hero.webp" srcSet="/landing/assets/fennec/hero-600.webp 600w, /landing/assets/fennec/hero.webp 1200w" sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1199px) 53vw, 600px" width="1200" height="910" alt={text.hero.mascotAlt} fetchPriority="high" decoding="async" />
    </div>
  </section>;
}
function FeatureCards({
  onSignup
}: SignupAction) {
  return <section id="features" className={styles.featureGrid} aria-label={text.featureLabel}>
    {text.features.map(feature => <Dialog key={feature.id}>
      <DialogTrigger asChild>
        <button type="button" className={styles.featureCard} aria-label={feature.title}>
          <img src={asset(feature.icon)} alt="" width="240" height="200" loading="lazy" decoding="async" />
          <span className={styles.featureTitle}>
            {feature.lines.map(line => <span key={line}>
              {line}
            </span>)}
          </span>
          <span className={styles.circle}>
            <ArrowRight aria-hidden="true" />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent data-landing-theme="true" className={styles.detail}>
        <div className={styles.detailIcon}>
          <img src={asset(feature.icon)} alt="" width="76" height="76" />
        </div>
        <DialogTitle className={styles.dialogTitle}>
          {feature.title}
        </DialogTitle>
        <DialogDescription className={styles.dialogDescription}>
          {feature.description}
        </DialogDescription>
        <Points items={feature.points} />
        <figure className={styles.productShot}>
          <img src={feature.image} width="1658" height="949" alt={feature.imageAlt} loading="lazy" decoding="async" />
        </figure>
        <p className={styles.notice}>
          {feature.note}
        </p>
        <DemoAction href={feature.href} onSignup={onSignup}>
          {text.demoAction}
        </DemoAction>
      </DialogContent>
    </Dialog>)}
  </section>;
}

/** Без публичного демо предлагаем существующую регистрацию, не обещая гостевой вход. */
function DemoAction({
  href,
  onSignup,
  children
}: SignupAction & {
  href: string;
  children: ReactNode;
}) {
  return hasDemo ? <a className={`${styles.button} ${styles.primary}`} href={demoHref(href)}>
    {children}
  </a> : <DialogClose asChild>
    <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => requestAnimationFrame(onSignup)}>
      {text.create}
    </button>
  </DialogClose>;
}
function Points({
  items
}: {
  items: readonly string[];
}) {
  return <ul className={styles.points}>
    {items.map(point => <li key={point}>
      <Check aria-hidden="true" />
      {point}
    </li>)}
  </ul>;
}
function AiStrip({
  onSignup
}: SignupAction) {
  return <section id="ai" aria-label={text.ai.title}>
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={styles.aiStrip}>
          <span className={styles.aiBadge}>
            <Sparkles aria-hidden="true" />
          </span>
          <span className={styles.aiTitle}>
            {text.ai.title}
          </span>
          <svg className={styles.aiLine} viewBox="0 0 450 160" fill="none" aria-hidden="true">
            <path d="M0 160C93 32 192 109 272 85S359 59 411 0" stroke="currentColor" strokeWidth="5" />
          </svg>
          <img className={styles.aiArt} src={asset("ai_sparkles")} width="172" height="172" alt="" loading="lazy" />
          <span className={styles.circle}>
            <ArrowRight aria-hidden="true" />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent data-landing-theme="true" className={styles.detail}>
        <div className={styles.detailIcon}>
          <img src={asset("ai_sparkles")} width="76" height="76" alt="" />
        </div>
        <DialogTitle className={styles.dialogTitle}>
          {text.ai.title}
        </DialogTitle>
        <DialogDescription className={styles.dialogDescription}>
          {text.ai.description}
        </DialogDescription>
        <Points items={text.ai.points} />
        <p className={styles.trust}>
          <Check aria-hidden="true" />
          {text.ai.trust}
        </p>
        <p className={styles.notice}>
          {text.ai.note}
        </p>
        <DemoAction href={text.ai.href} onSignup={onSignup}>
          {text.ai.action}
        </DemoAction>
      </DialogContent>
    </Dialog>
  </section>;
}
function Pricing({
  onSignup
}: SignupAction) {
  return <section id="pricing" className={styles.pricing} aria-labelledby="pricing-title">
    <h2 id="pricing-title" className={styles.sectionTitle}>
      {text.pricing.title}
    </h2>
    <div className={styles.pricingGrid}>
      {text.pricing.plans.map(plan => <article key={plan.id} className={`${styles.plan} ${plan.id === "pro" ? styles.pro : ""}`}>
        <div className={styles.planTop}>
          <h3>
            {plan.name}
          </h3>
          {plan.badge && <span className={styles.trialBadge}>
            {plan.badge}
          </span>}
        </div>
        <p className={styles.price}>
          <b>
            {plan.price}
          </b>
          {plan.period && <span>
            {plan.period}
          </span>}
        </p>
        {plan.note && <span className={styles.priceNote}>
          {plan.note}
        </span>}
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" className={styles.planDetails} aria-label={text.pricing.label(plan.name)}>
              <span>
                {text.pricing.details}
              </span>
              <span className={styles.circle}>
                <ArrowRight aria-hidden="true" />
              </span>
            </button>
          </DialogTrigger>
          <DialogContent data-landing-theme="true" className={styles.detail}>
            <DialogTitle className={styles.dialogTitle}>
              {plan.name}
            </DialogTitle>
            <DialogDescription className={styles.dialogDescription}>
              {plan.description}
            </DialogDescription>
            <p className={styles.dialogPrice}>
              {plan.price}
              <span>
                {plan.period ?? plan.note}
              </span>
            </p>
            {plan.badge && <span className={styles.trialBadge}>
              {plan.badge}
            </span>}
            <Points items={plan.points} />
            <p className={styles.notice}>
              {text.pricing.availability}
            </p>
            <DialogClose asChild>
              <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => requestAnimationFrame(onSignup)}>
                {plan.cta}
              </button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </article>)}
      <div id={FINAL_CTA_ID} className={styles.finalCard}>
        <Rays />
        <h2>
          {text.final.title.map(line => <span key={line}>
            {line}
          </span>)}
        </h2>
        <SignupButton onSignup={onSignup} place="final">
          {text.final.cta}
          <ArrowRight aria-hidden="true" />
        </SignupButton>
      </div>
    </div>
  </section>;
}
function Demo({
  onSignup
}: SignupAction) {
  return <section id="demo" className={styles.demo} aria-labelledby="demo-title">
    <div className={styles.demoCopy}>
      <span className={styles.kicker}>
        {hasDemo ? text.demo.eyebrow : text.demo.unavailableEyebrow}
      </span>
      <h2 id="demo-title" className={styles.sectionTitle}>
        {text.demo.title}
      </h2>
      <p>
        {hasDemo ? text.demo.text : text.demo.unavailableText}
      </p>
      {hasDemo ? <a href={demoHref()} className={`${styles.button} ${styles.outline}`}>
        {text.demo.cta}
      </a> : <SignupButton onSignup={onSignup} />}
    </div>
    <figure className={styles.demoPreview}>
      <img src="/landing/previews/overview.png" width="1658" height="949" alt={text.demo.imageAlt} loading="lazy" decoding="async" />
    </figure>
  </section>;
}
function Reviews() {
  const showSamples = landing.testimonials.sample && import.meta.env.DEV;
  const reviews = showSamples ? landing.testimonials.items.filter((_, index) => [0, 3, 5].includes(index)) : landing.testimonials.sample ? [] : landing.testimonials.items.slice(0, 3);
  return <section id="reviews" className={styles.reviews} aria-labelledby="reviews-title">
    <div className={styles.sectionHead}>
      <h2 id="reviews-title" className={styles.sectionTitle}>
        {text.reviews.title}
      </h2>
      {showSamples && <p className={styles.sampleLabel}>
        {text.reviews.sample}
      </p>}
    </div>
    {reviews.length ? <div className={styles.reviewGrid}>
      {reviews.map(review => <figure key={review.name} className={styles.reviewCard}>
        <blockquote>
          {review.quote}
        </blockquote>
        <figcaption>
          <span className={styles.reviewAvatar} aria-hidden="true">
            {review.initials}
          </span>
          <span>
            <b>
              {review.name}
            </b>
            <span>
              {review.role}
            </span>
          </span>
        </figcaption>
      </figure>)}
    </div> : <div className={styles.emptyReviews}>
      <h3>
        {text.reviews.emptyTitle}
      </h3>
      <p>
        {text.reviews.emptyText}
      </p>
    </div>}
  </section>;
}
function Signup({
  signup
}: Pick<Props, "signup">) {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      track("signup_view");
      observer.disconnect();
    }, {
      threshold: .4
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <section ref={section} id={SIGNUP_SECTION_ID} className={styles.signup} aria-labelledby="signup-title">
    <div className={styles.signupCopy}>
      <span className={styles.kicker}>
        {text.signup.eyebrow}
      </span>
      <h2 id="signup-title" className={styles.sectionTitle}>
        {text.signup.title}
      </h2>
      <p>
        {text.signup.text}
      </p>
      <Points items={text.signup.perks} />
      <span className={styles.signupTrial}>
        {text.signup.trial}
      </span>
    </div>
    <div className={styles.signupForm}>
      <SignupWizard {...signup} />
    </div>
  </section>;
}
function Faq() {
  return <section id="faq" className={styles.faq} aria-labelledby="faq-title">
    <h2 id="faq-title" className={styles.sectionTitle}>
      {text.faq.title}
    </h2>
    <Tabs defaultValue="teachers" className={styles.faqTabs}>
      <TabsList aria-label={text.faq.label} className={styles.faqTabList}>
        {text.faq.groups.map(group => <TabsTrigger key={group.id} value={group.id} className={styles.faqTab}>
          {group.title}
        </TabsTrigger>)}
      </TabsList>
      {text.faq.groups.map(group => <TabsContent key={group.id} value={group.id} className={styles.faqPanel}>
        {group.items.map(item => <details key={item.q} className={styles.question}>
          <summary>
            {item.q}
            <Plus aria-hidden="true" />
          </summary>
          <p>
            {item.a}
          </p>
        </details>)}
      </TabsContent>)}
    </Tabs>
  </section>;
}
function Footer() {
  return <footer className={styles.footer}>
    <div className={styles.footerBrand}>
      <Brand />
      <span>
        {landing.footer.publicCopyright}
      </span>
    </div>
    <nav aria-label={landing.footer.navLabel}>
      {landing.footer.links.map(link => <a key={link.href} href={link.href}>
        {link.label}
      </a>)}
      {env.supportUrl ? <a href={env.supportUrl} target="_blank" rel="noreferrer">
        {landing.footer.support}
      </a> : <a href="#faq">
        {landing.footer.faq.label}
      </a>}
    </nav>
  </footer>;
}
export function LandingPage({
  signup,
  onLogin,
  onSignup
}: Props) {
  return <div className={styles.root} id="top" data-landing-theme="true">
    <a className={styles.skipLink} href="#landing-main">
      {text.skip}
    </a>
    <div className={styles.container}>
      <Header onLogin={onLogin} onSignup={onSignup} />
      <main id="landing-main">
        <Hero onSignup={onSignup} />
        <FeatureCards onSignup={onSignup} />
        <AiStrip onSignup={onSignup} />
        <Pricing onSignup={onSignup} />
        <Demo onSignup={onSignup} />
        <Reviews />
        <Signup signup={signup} />
        <Faq />
      </main>
      <Footer />
    </div>
    <RoleChooser />
  </div>;
}
