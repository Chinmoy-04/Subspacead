"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import Link from "next/link";
import { useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pulls its content toward the pointer while hovered (Cuberto RoundButton). */
export function Magnetic({ children, strength = 0.3, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.6 });
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={cn("inline-flex", className)}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

type PillProps = {
  variant?: "fill" | "outline";
  size?: "md" | "lg";
  children: ReactNode;
  className?: string;
} & (
  | ({ href: string; external?: boolean } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">)
  | ({ href?: undefined } & Omit<ComponentProps<"button">, "className" | "children">)
);

/** Rounded pill CTA with a fill sweep on hover. */
export function PillButton(props: PillProps) {
  const { variant = "fill", size = "md", children, className } = props;
  const classes = cn(
    "group/pill relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-medium whitespace-nowrap",
    "transition-[color,background-color,border-color,transform] duration-[400ms] ease-[var(--ease-soft)]",
    "disabled:pointer-events-none disabled:opacity-50",
    size === "md" ? "h-12 px-6 text-[0.9375rem]" : "h-[3.625rem] px-8 text-base",
    variant === "fill"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "border border-current/25 text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground",
    className
  );
  const inner = <span className="relative z-10 inline-flex items-center gap-2">{children}</span>;

  if (props.href !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { href, external, variant: _v, size: _s, children: _c, className: _cn, ...rest } = props;
    if (external) {
      return (
        <Magnetic>
          <a href={href} target="_blank" rel="noreferrer" className={classes}>
            {inner}
          </a>
        </Magnetic>
      );
    }
    return (
      <Magnetic>
        <Link href={href} className={classes} {...rest}>
          {inner}
        </Link>
      </Magnetic>
    );
  }
  const { variant: _v, size: _s, children: _c, className: _cn, href: _h, ...rest } = props;
  return (
    <Magnetic>
      <button type="button" className={classes} {...rest}>
        {inner}
      </button>
    </Magnetic>
  );
}

/** Small round arrow badge (Cuberto "Explore ↗"). */
export function RoundArrow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-110 group-hover:rotate-45",
        className
      )}
    >
      {children}
    </span>
  );
}
