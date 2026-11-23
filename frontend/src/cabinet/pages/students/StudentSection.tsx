import type { ReactNode } from "react";

export function StudentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3.5 rounded-2xl border bg-card p-5">
      <h3 className="m-0 font-[family-name:var(--font-display)] text-base font-extrabold tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

export function StudentEmpty({ text }: { text: string }) {
  return <p className="m-0 py-6 text-center text-base font-semibold text-muted-foreground">{text}</p>;
}
