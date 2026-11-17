import type { ReactNode } from "react";
import { toast } from "sonner";
import { Toaster } from "@/shared/ui/kit/sonner";
import { TooltipProvider } from "@/shared/ui/kit/tooltip";
import { cabinet } from "../content/cabinet.ru";

type Notifier = { notify: (text: string) => void; notifySoon: (label: string) => void };

const notifier: Notifier = {
  notify: (text) => {
    toast(text);
  },
  notifySoon: (label) => {
    toast(cabinet.notify.soon(label));
  },
};

export function useNotifier(): Notifier {
  return notifier;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      {children}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
