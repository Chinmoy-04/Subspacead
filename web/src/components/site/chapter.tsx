import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/** Zero-padded chapter index: 01, 02, … */
export function formatChapter(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** Sticky mono index in the left rail (lg+). */
export function StickyChapterIndex({
  index,
  className,
  topClassName = "lg:top-28",
}: {
  index: number;
  className?: string;
  topClassName?: string;
}) {
  return (
    <div
      className={cn(
        "hidden self-start py-16 lg:sticky lg:block lg:py-24",
        topClassName,
        className
      )}
    >
      <span className="font-mono text-sm text-muted-foreground tabular-nums">{formatChapter(index)}</span>
    </div>
  );
}

/** Full-width chapter band with sticky index + freeform content. */
export function ChapterRow({
  index,
  children,
  className,
  contentClassName,
}: {
  index: number;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "container-site grid grid-cols-1 border-b border-border lg:grid-cols-[7rem_minmax(0,1fr)]",
        className
      )}
    >
      <StickyChapterIndex index={index} />
      <div className={cn("min-w-0 border-border lg:border-l", contentClassName)}>{children}</div>
    </section>
  );
}

type ChapterSectionProps = {
  index: number;
  eyebrow?: string;
  title: ReactNode;
  children: ReactNode;
  /** Third column on large screens (e.g. method visual). */
  aside?: ReactNode;
  className?: string;
  showMobileIndex?: boolean;
};

/**
 * Editorial chapter: sticky index | title | body.
 * Pass `aside` for a third column instead of stacking it under the body.
 */
export function ChapterSection({
  index,
  eyebrow,
  title,
  children,
  aside,
  className,
  showMobileIndex = true,
}: ChapterSectionProps) {
  return (
    <ChapterRow index={index} className={className} contentClassName="lg:border-l-0">
      <div
        className={cn(
          "grid grid-cols-1 lg:border-l lg:border-border",
          aside ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]" : "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]"
        )}
      >
        <Reveal className="flex flex-col gap-4 border-border py-14 md:py-20 lg:border-r lg:px-10 lg:py-24">
          {eyebrow ? (
            <>
              {showMobileIndex ? (
                <p className="text-eyebrow text-muted-foreground lg:hidden">
                  {formatChapter(index)} · {eyebrow}
                </p>
              ) : null}
              <p className={cn("text-eyebrow text-muted-foreground", showMobileIndex && "hidden lg:block")}>
                {eyebrow}
              </p>
            </>
          ) : showMobileIndex ? (
            <p className="font-mono text-sm text-muted-foreground tabular-nums lg:hidden">{formatChapter(index)}</p>
          ) : null}
          <div className="text-title max-w-[18ch] text-balance">{title}</div>
        </Reveal>
        <Reveal delay={0.08} className="flex flex-col gap-5 pb-14 md:pb-20 lg:gap-8 lg:py-24 lg:pl-12 lg:pr-0">
          {children}
          {aside}
        </Reveal>
      </div>
    </ChapterRow>
  );
}
