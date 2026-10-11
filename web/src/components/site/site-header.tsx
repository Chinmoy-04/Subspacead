"use client";

import { useLenis } from "lenis/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Magnetic, PillButton } from "./magnetic";
import { NAV_LINKS, PAPER_REPO_URL, PAPER_URL, REPO_URL } from "./nav-links";
import { ThemeSwitcher } from "./theme-switcher";

const EASE = [0.16, 1, 0.3, 1] as const;

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline text-[1.3125rem] font-semibold tracking-[-0.03em]", className)}>
      subspace<span className="font-normal opacity-55">ad</span>
    </span>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="group relative inline-flex h-10 items-center text-[0.9375rem]"
    >
      <span className="relative block overflow-hidden leading-[1.4]">
        <span className="block transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-full">
          {label}
          <span className="absolute top-full left-0" aria-hidden>
            {label}
          </span>
        </span>
      </span>
      <span
        className={cn(
          "absolute bottom-1.5 left-0 h-px w-full origin-left bg-current transition-transform duration-500 ease-[var(--ease-out-expo)]",
          active ? "scale-x-100" : "scale-x-0"
        )}
      />
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const lenis = useLenis();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (open) lenis?.stop();
    else lenis?.start();
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, lenis]);

  return (
    <>
      <header className="relative z-40">
        <div className="container-site relative flex h-20 items-center md:h-24">
          <Link href="/" aria-label="SubspaceAD home" className="relative z-10 shrink-0">
            <Wordmark />
          </Link>
          <nav
            aria-label="Primary"
            className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-8 lg:flex"
          >
            {NAV_LINKS.map((l) => (
              <NavLink key={l.href} {...l} />
            ))}
          </nav>
          <div className="relative z-10 ml-auto flex items-center gap-3">
            <ThemeSwitcher className="hidden sm:inline-flex" />
            <span className="hidden sm:inline-flex">
              <PillButton href="/demo" data-cursor="Try it">
                Live demo
              </PillButton>
            </span>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-foreground/15 px-4 text-sm lg:hidden"
              aria-expanded={open}
              aria-controls="site-menu"
            >
              Menu
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {scrolled && !open && (
          <motion.div
            className="fixed top-5 right-5 z-50 md:top-7 md:right-8"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <Magnetic strength={0.4}>
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setOpen(true)}
                className="group flex size-16 items-center justify-center rounded-full bg-foreground text-background shadow-[0_10px_40px_-12px_rgb(0_0_0/0.45)]"
                aria-label="Open menu"
                aria-expanded={open}
                aria-controls="site-menu"
              >
                <span className="flex w-6 flex-col gap-1.5">
                  <span className="h-px w-full bg-current transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-x-75" />
                  <span className="h-px w-full bg-current transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-x-50" />
                </span>
              </button>
            </Magnetic>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            id="site-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="inverse fixed inset-0 z-[60] flex flex-col overflow-y-auto"
            data-lenis-prevent
            initial={{ clipPath: "circle(0% at calc(100% - 4rem) 4rem)" }}
            animate={{ clipPath: "circle(150% at calc(100% - 4rem) 4rem)" }}
            exit={{ clipPath: "circle(0% at calc(100% - 4rem) 4rem)" }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0, 1] }}
          >
            <div className="container-site flex h-20 items-center justify-between md:h-24">
              <Link href="/" aria-label="SubspaceAD home">
                <Wordmark />
              </Link>
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center rounded-full border border-foreground/20 px-4 text-sm transition-colors hover:bg-foreground hover:text-background"
              >
                Close
              </button>
            </div>
            <div className="container-site grid flex-1 gap-12 py-10 md:grid-cols-[1fr_auto] md:items-end md:py-16">
              <nav aria-label="Menu">
                <ul className="flex flex-col gap-1">
                  {[{ href: "/", label: "Home" }, ...NAV_LINKS, { href: "/demo", label: "Live demo" }].map((l, i) => (
                    <li key={l.href} className="overflow-hidden">
                      <motion.div
                        initial={{ y: "110%" }}
                        animate={{ y: "0%" }}
                        transition={{ duration: 0.9, ease: EASE, delay: 0.25 + i * 0.05 }}
                      >
                        <Link
                          href={l.href}
                          className="group inline-flex items-baseline gap-4 text-title transition-colors duration-300 hover:text-primary"
                        >
                          <span className="font-mono text-sm tabular-nums text-muted-foreground">0{i + 1}</span>
                          {l.label}
                        </Link>
                      </motion.div>
                    </li>
                  ))}
                </ul>
              </nav>
              <motion.div
                className="flex flex-col gap-6 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                <div className="flex flex-col gap-2">
                  <span className="text-eyebrow text-muted-foreground">Mode</span>
                  <ThemeSwitcher className="self-start" />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-eyebrow text-muted-foreground">Elsewhere</span>
                  <a href={PAPER_URL} target="_blank" rel="noreferrer" className="hover:text-primary">
                    Paper · arXiv:2602.23013
                  </a>
                  <a href={PAPER_REPO_URL} target="_blank" rel="noreferrer" className="hover:text-primary">
                    Official code
                  </a>
                  <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-primary">
                    This reproduction
                  </a>
                  <Link href="/lab/runs" className="hover:text-primary">
                    Lab · run monitor
                  </Link>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
