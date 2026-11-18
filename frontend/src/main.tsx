import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { legalDocOf } from "./app/legal";
import { LegalPage } from "./app/LegalPage";
import { usePathname } from "./app/router";
import { CabinetApp, isCabinetPath } from "./cabinet/CabinetApp";
import "./styles/fonts";
// Стили уведомлений файлом из сборки: свой <style> sonner вставить не может — его режет CSP.
import "sonner/dist/styles.css";
import "./styles/global.css";
import "./styles/tailwind.css";

function Root() {
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  if (isCabinetPath(pathname)) return <CabinetApp pathname={pathname} />;
  const legalDoc = legalDocOf(pathname);
  return legalDoc ? <LegalPage doc={legalDoc} /> : <App />;
}

const root = document.getElementById("root");
if (!root) throw new Error("В index.html нет элемента #root");

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
