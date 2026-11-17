import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { usePathname } from "./app/router";
import { CabinetApp, isCabinetPath } from "./cabinet/CabinetApp";
import "./styles/global.css";

function Root() {
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  return isCabinetPath(pathname) ? <CabinetApp pathname={pathname} /> : <App />;
}

const root = document.getElementById("root");
if (!root) throw new Error("В index.html нет элемента #root");

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
