"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Magnetic } from "@/components/site/magnetic";
import { PAPER_URL, REPO_URL } from "@/components/site/nav-links";

const COMMANDS = [
  "uv run uvicorn server.main:app --port 8000",
  "cd web && npm i && npm run dev",
];

export function Outro() {
  return (
    <section className="inverse">
      <div className="container-site grid grid-cols-[minmax(0,1fr)] gap-16 py-28 md:py-40 lg:grid-cols-[minmax(0,1.3fr)_auto] lg:items-end">
        <div className="flex min-w-0 flex-col gap-10">
          <h2 className="text-display max-w-[11ch] text-balance">Score a defect yourself.</h2>
          <p className="max-w-lg text-lg text-muted-foreground text-pretty">
            Start the backend, pick a category, fit the subspace on a single normal image, then score any test image or
            one of your own.
          </p>
          <div className="flex max-w-xl flex-col gap-2">
            {COMMANDS.map((c) => (
              <Command key={c} text={c} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[0.9375rem]">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-primary">
              Source on GitHub
            </a>
            <a href={PAPER_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-primary">
              Paper on arXiv
            </a>
            <Link href="/method" className="underline underline-offset-4 hover:text-primary">
              How the method works
            </Link>
          </div>
        </div>
        <Magnetic strength={0.35} className="justify-self-start lg:justify-self-end">
          <Link
            href="/demo"
            className="flex size-48 items-center justify-center rounded-full bg-primary text-center text-lg font-medium text-primary-foreground transition-[background-color,color,scale,opacity] duration-500 ease-[var(--ease-out-expo)] hover:scale-105 hover:opacity-90 md:size-56"
          >
            Open the
            <br />
            live demo
          </Link>
        </Magnetic>
      </div>
    </section>
  );
}

function Command({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface py-2 pr-2 pl-4 font-mono text-[0.8125rem]">
      <code className="min-w-0 overflow-x-auto whitespace-nowrap" data-lenis-prevent>
        <span className="mr-2 text-muted-foreground select-none" aria-hidden>
          $
        </span>
        {text}
      </code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        aria-label={copied ? "Copied" : `Copy command: ${text}`}
      >
        {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      </button>
    </div>
  );
}
