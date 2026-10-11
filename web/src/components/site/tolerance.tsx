import { cn } from "@/lib/utils";

/** Presentation convention, not a paper claim: deviations are graded against the published mean. */
export const TOLERANCE = { match: 0.5, within: 1.0 } as const;

export type ToleranceState = "match" | "within" | "outside";

export function toleranceOf(delta: number): ToleranceState {
  const d = Math.abs(delta);
  if (d <= TOLERANCE.match) return "match";
  if (d <= TOLERANCE.within) return "within";
  return "outside";
}

export const TOLERANCE_LABEL: Record<ToleranceState, string> = {
  match: "Match",
  within: "Within ±1.0",
  outside: "Outside ±1.0",
};

const TOLERANCE_SHORT: Record<ToleranceState, string> = {
  match: "Match",
  within: "±1.0",
  outside: "Out",
};

export function formatDelta(delta: number, digits = 1) {
  const r = Number(delta.toFixed(digits));
  if (r === 0) return (0).toFixed(digits);
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(digits)}`;
}

/** Filled disc = match, half disc = within band, ring = outside band. Drawn in the theme accent. */
export function ToleranceMark({ state, className }: { state: ToleranceState; className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={cn("size-3 shrink-0 text-primary", className)} aria-hidden>
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      {state === "match" && <circle cx="6" cy="6" r="5" fill="currentColor" />}
      {state === "within" && <path d="M6 1a5 5 0 0 1 0 10z" fill="currentColor" />}
    </svg>
  );
}

/** Glyph plus text; below `sm` the text shortens but never disappears. */
export function Tolerance({ delta, className }: { delta: number; className?: string }) {
  const state = toleranceOf(delta);
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <ToleranceMark state={state} />
      <span className="sm:hidden" aria-hidden>
        {TOLERANCE_SHORT[state]}
      </span>
      <span className="max-sm:sr-only">{TOLERANCE_LABEL[state]}</span>
    </span>
  );
}
