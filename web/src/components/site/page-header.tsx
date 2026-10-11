import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, lede, aside, className }: { title: string; lede: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <header className={cn("container-site flex flex-col gap-8 pt-8 pb-10 md:pt-14 md:pb-14 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="flex max-w-3xl flex-col gap-6">
        <h1 className="text-display">{title}</h1>
        <div className="max-w-2xl text-lg text-muted-foreground text-pretty">{lede}</div>
      </div>
      {aside}
    </header>
  );
}

export function SourceNote({ source, loading }: { source: "live" | "bundled"; loading?: boolean }) {
  return (
    <p className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground" aria-live="polite">
      <span
        className={cn("size-2 rounded-full", source === "live" ? "bg-primary" : "bg-foreground/30", loading && "animate-pulse")}
        aria-hidden
      />
      {loading ? "Checking the API…" : source === "live" ? "Live from results/ via the API" : "Bundled snapshot (API offline)"}
    </p>
  );
}
