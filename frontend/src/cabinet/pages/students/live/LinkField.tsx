import { Copy, Send } from "lucide-react";
import { cabinet } from "../../../content/cabinet.ru";
import { Button } from "../../../ui/Button";
import { useNotifier } from "../../../ui/Notifications";
import { Input } from "@/shared/ui/kit/input";

const text = cabinet.teacher.live.invite;

/** Ссылка-приглашение: поле для выделения, копирование и отправка в Telegram. */
export function LinkField({ url, label = text.linkLabel }: { url: string; label?: string }) {
  const { notify } = useNotifier();
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text.shareText)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify(text.copied);
    } catch {
      // Буфер обмена может быть недоступен — ссылку видно в поле, её можно выделить вручную.
    }
  };

  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5">
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
        <Input readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="font-semibold" />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button icon={Copy} onClick={() => void copy()}>
          {text.copy}
        </Button>
        <a
          href={telegramHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--color-blue)] px-4 text-sm font-bold text-white no-underline transition-opacity hover:opacity-90"
        >
          <Send size={16} aria-hidden="true" />
          {text.telegram}
        </a>
      </div>
    </div>
  );
}
