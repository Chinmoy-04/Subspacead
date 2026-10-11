"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export const PILL =
  "h-10 rounded-full border border-border px-4 text-sm data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background";

/** Single-select pill row used for page filters. */
export function Pills<T extends string | number>({
  label,
  value,
  options,
  onChange,
  format = (v) => String(v),
  mono,
  className,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase" aria-hidden>
        {label}
      </span>
      <ToggleGroup
        type="single"
        value={String(value)}
        onValueChange={(v) => {
          const match = options.find((o) => String(o) === v);
          if (match !== undefined) onChange(match);
        }}
        aria-label={label}
        className="flex flex-wrap justify-start gap-1.5"
      >
        {options.map((o) => (
          <ToggleGroupItem key={String(o)} value={String(o)} className={cn(PILL, mono && "font-mono text-xs tracking-wide")}>
            {format(o)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
