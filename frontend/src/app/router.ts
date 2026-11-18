import { useSyncExternalStore } from "react";

const NAVIGATE_EVENT = "app:navigate";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(NAVIGATE_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(NAVIGATE_EVENT, listener);
  };
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function useSearch() {
  return useSyncExternalStore(subscribe, () => window.location.search);
}

export function navigate(path: string, options: { scroll?: boolean } = {}) {
  const { scroll = true } = options;
  if (path === window.location.pathname + window.location.search) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
  if (scroll) window.scrollTo(0, 0);
}
