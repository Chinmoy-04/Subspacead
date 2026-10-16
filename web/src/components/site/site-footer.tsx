import Link from "next/link";
import { NAV_LINKS, PAPER_REPO_URL, PAPER_URL, REPO_URL } from "./nav-links";
import { Wordmark } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="inverse">
      <div className="container-site grid gap-12 border-t border-border py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Wordmark />
          <p className="max-w-sm text-sm text-muted-foreground">
            A from-scratch reproduction of SubspaceAD (Lendering, Akdag &amp; Bondarev). Frozen DINOv2 features, a PCA
            subspace from a few normal images, residual scoring.
          </p>
        </div>
        <FooterColumn title="Explore">
          {NAV_LINKS.map((l) => (
            <FooterLink key={l.href} href={l.href}>
              {l.label}
            </FooterLink>
          ))}
          <FooterLink href="/demo">Live demo</FooterLink>
        </FooterColumn>
        <FooterColumn title="Research">
          <FooterLink href={PAPER_URL} external>
            arXiv:2602.23013
          </FooterLink>
          <FooterLink href={PAPER_REPO_URL} external>
            Official code
          </FooterLink>
          <FooterLink href={REPO_URL} external>
            This reproduction
          </FooterLink>
          <FooterLink href="/lab/runs">Lab · runs</FooterLink>
        </FooterColumn>
        <FooterColumn title="Legal">
          <FooterLink href="/privacy">Privacy policy</FooterLink>
          <FooterLink href="/terms">Terms of use</FooterLink>
          <p className="mt-2 text-sm text-muted-foreground">
            MVTec-AD imagery is licensed CC BY-NC-SA 4.0 for non-commercial research. VisA is CC BY 4.0.
          </p>
        </FooterColumn>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-eyebrow text-muted-foreground">{title}</span>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  const cls = "text-sm transition-colors duration-300 hover:text-primary";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
