import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "./page-header";

export type LegalSection = {
  title: string;
  body: ReactNode[];
};

export function LegalDoc({
  title,
  lede,
  updated,
  sections,
  related,
}: {
  title: string;
  lede: ReactNode;
  updated: string;
  sections: LegalSection[];
  related: { href: string; label: string };
}) {
  return (
    <>
      <PageHeader
        title={title}
        lede={lede}
        aside={
          <p className="font-mono text-xs text-muted-foreground">
            Last updated <time dateTime={updated}>{formatDate(updated)}</time>
          </p>
        }
      />
      <article className="container-narrow flex flex-col gap-12 pb-28 md:pb-40">
        {sections.map((section) => (
          <section key={section.title} className="flex max-w-2xl flex-col gap-4">
            <h2 className="text-xl font-medium tracking-tight md:text-2xl">{section.title}</h2>
            {section.body.map((para, i) => (
              <p key={i} className="text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
                {para}
              </p>
            ))}
          </section>
        ))}
        <p className="max-w-2xl border-t border-border pt-8 text-sm text-muted-foreground">
          Also see the{" "}
          <Link href={related.href} className="text-foreground underline underline-offset-4 hover:text-primary">
            {related.label}
          </Link>
          .
        </p>
      </article>
    </>
  );
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
