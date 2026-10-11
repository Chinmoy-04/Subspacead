"use client";

import { UploadIcon, XIcon } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { categoryLabel } from "@/lib/content";
import { cn } from "@/lib/utils";

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

const SEGMENT =
  "h-10 flex-1 rounded-full border border-border px-3 text-sm data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background";

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  format = (v) => String(v),
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  disabled?: boolean;
  format?: (v: T) => string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      onValueChange={(v) => {
        if (!v) return;
        const match = options.find((o) => String(o) === v);
        if (match !== undefined) onChange(match);
      }}
      aria-label={label}
      disabled={disabled}
      className="flex w-full gap-1.5"
    >
      {options.map((o) => (
        <ToggleGroupItem key={String(o)} value={String(o)} className={SEGMENT}>
          {format(o)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function Choice({
  id,
  value,
  options,
  onChange,
  disabled,
  placeholder,
}: {
  id?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="h-11 w-full rounded-xl">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80" data-lenis-prevent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function categoryOptions(cats: string[]) {
  return cats.map((c) => ({ value: c, label: categoryLabel(c) }));
}

export function NumberField({
  id,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n))));
      }}
      className="h-11 rounded-xl font-mono tabular-nums"
    />
  );
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <span className="w-8 text-right font-mono text-sm tabular-nums">{value}</span>
    </div>
  );
}

export function FilePicker({
  files,
  onChange,
  multiple,
  label,
  disabled,
  accept = "image/png,image/jpeg",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  label: string;
  disabled?: boolean;
  accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <input
        ref={ref}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onChange(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        className={cn(
          "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/25 text-sm transition-colors hover:border-foreground",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <UploadIcon className="size-4" aria-hidden />
        {label}
      </label>
      {files.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-1.5">
              <span className="truncate font-mono">{f.name}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Remove ${f.name}`}
                className="inline-flex size-6 items-center justify-center rounded-md hover:bg-surface-2"
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
