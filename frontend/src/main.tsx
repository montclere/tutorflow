import { IconContext } from "@phosphor-icons/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { legalDocOf } from "./app/legal";
import { LegalPage } from "./app/LegalPage";
import { usePathname } from "./app/router";
import { CabinetApp, isCabinetPath } from "./cabinet/CabinetApp";
import { env } from "./config/env";
import { LearnerApp, learnerPageOf } from "./learner/LearnerApp";
import "./styles/fonts";
// Стили уведомлений файлом из сборки: свой <style> sonner вставить не может — его режет CSP.
import "sonner/dist/styles.css";
import "./styles/global.css";
import "./styles/tailwind.css";

function Root() {
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  // Рабочая сборка: приглашения и кабинеты ученика и родителя по API; в демо /student — тестовый кабинет.
  const learnerPage = env.demo ? null : learnerPageOf(pathname);
  if (learnerPage) return <LearnerApp pathname={pathname} page={learnerPage} />;
  if (isCabinetPath(pathname)) return <CabinetApp pathname={pathname} />;
  const legalDoc = legalDocOf(pathname);
  return legalDoc ? <LegalPage doc={legalDoc} /> : <App />;
}

const root = document.getElementById("root");
if (!root) throw new Error("В index.html нет элемента #root");

createRoot(root).render(
  <StrictMode>
    {/* Иконки Phosphor — двухтоновые по умолчанию (VIBE-15). */}
    <IconContext.Provider value={{ weight: "duotone" }}>
      <Root />
    </IconContext.Provider>
  </StrictMode>,
);
