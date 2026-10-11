import { Marquee } from "@/components/ui/marquee";
import { DATASET_LABEL, bundledResults, categoryLabel } from "@/lib/content";
import type { Dataset } from "@/lib/types";

function categories(ds: Dataset) {
  return Object.keys(bundledResults.summary?.[ds]?.["1"]?.categories ?? {}).sort();
}

export function CategoryMarquee() {
  const rows: Dataset[] = ["mvtec", "visa"];
  return (
    <div className="flex flex-col gap-2 overflow-hidden">
      <ul className="sr-only">
        {rows.map((ds) => (
          <li key={ds}>
            {DATASET_LABEL[ds]}: {categories(ds).map(categoryLabel).join(", ")}
          </li>
        ))}
      </ul>
      {rows.map((ds, r) => (
        <Marquee
          key={ds}
          reverse={r === 1}
          pauseOnHover
          repeat={3}
          aria-hidden
          className="p-0 [--duration:70s] [--gap:3rem]"
        >
          {categories(ds).map((c) => (
            <span key={c} className="flex items-baseline gap-3 text-[clamp(2rem,1.2rem+3vw,4rem)] font-medium tracking-[-0.02em] whitespace-nowrap capitalize">
              {categoryLabel(c)}
              <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{DATASET_LABEL[ds]}</span>
            </span>
          ))}
        </Marquee>
      ))}
    </div>
  );
}
