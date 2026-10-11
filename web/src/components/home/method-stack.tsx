"use client";

import { useLenis } from "lenis/react";
import { useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { formatChapter } from "@/components/site/chapter";
import { cn } from "@/lib/utils";
import { METHOD_STEPS } from "./method-steps";

export function MethodStack() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const lenis = useLenis();
  const [desktop, setDesktop] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 64rem)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(METHOD_STEPS.length - 1, Math.max(0, Math.floor(v * METHOD_STEPS.length))));
  });

  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    const y = top + (span * (i + 0.5)) / METHOD_STEPS.length;
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div ref={ref} className="relative lg:h-[420vh]">
      <div className="lg:sticky lg:top-0 lg:flex lg:h-dvh lg:items-center">
        <div className="container-site grid w-full gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-20">
          <div className="flex flex-col gap-6 lg:justify-center">
            <h2 className="text-title text-balance">Five steps, no training.</h2>
            <p className="max-w-md text-lg text-muted-foreground text-pretty">
              The whole detector is a frozen feature extractor and one PCA. These are the paper settings the benchmark
              ran with.
            </p>
            <p className="hidden font-mono text-sm text-muted-foreground tabular-nums lg:block" aria-hidden>
              {formatChapter(active)} / {String(METHOD_STEPS.length).padStart(2, "0")}
            </p>
          </div>

          <ol className="flex flex-col gap-2">
            {METHOD_STEPS.map((step, i) => {
              const open = !desktop || i === active;
              const Tag = desktop ? "button" : "div";
              return (
                <li key={step.title}>
                  <Tag
                    {...(desktop ? { type: "button" as const, onClick: () => jump(i), "aria-expanded": open } : {})}
                    className={cn(
                      "group block w-full rounded-2xl text-left transition-colors duration-500 ease-[var(--ease-soft)]",
                      !desktop
                        ? "bg-surface"
                        : open
                          ? "inverse"
                          : "bg-surface text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex items-baseline gap-5 px-6 py-5 md:px-8">
                      <span className="font-mono text-sm text-muted-foreground tabular-nums">{formatChapter(i)}</span>
                      <span className="text-subtitle">{step.title}</span>
                    </div>
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-700 ease-[var(--ease-out-expo)]",
                        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="grid gap-6 px-6 pb-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:px-8 md:pl-[4.25rem]">
                          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-muted-foreground">{step.body}</p>
                          <dl className="divide-y divide-border border-y border-border text-[0.8125rem]">
                            {step.readings.map(([k, v]) => (
                              <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2">
                                <dt className="font-mono text-xs leading-5 text-muted-foreground">{k}</dt>
                                <dd className="text-foreground tabular-nums">{v}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>
                    </div>
                  </Tag>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
