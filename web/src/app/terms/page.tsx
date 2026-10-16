import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/site/legal-doc";
import { PAPER_REPO_URL, PAPER_URL, REPO_URL } from "@/components/site/nav-links";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Terms for using the SubspaceAD reproduction site, demo, and linked research materials.",
};

const UPDATED = "2026-10-16";

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of use"
      updated={UPDATED}
      related={{ href: "/privacy", label: "Privacy policy" }}
      lede={
        <>
          By using this site you agree to these terms. If you disagree, do not use the site or the accompanying demo
          instructions.
        </>
      }
      sections={[
        {
          title: "What this site is",
          body: [
            <>
              This website presents an independent, from-scratch reproduction of SubspaceAD (
              <a href={PAPER_URL} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
                Lendering, Akdag &amp; Bondarev, arXiv:2602.23013
              </a>
              ). It is a portfolio and research instrument: tables, ablations, gallery figures, method notes, and
              optional local demo instructions.
            </>,
            <>
              It is not the authors’ official site. For their implementation, see{" "}
              <a href={PAPER_REPO_URL} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
                the official code repository
              </a>
              .
            </>,
          ],
        },
        {
          title: "Acceptable use",
          body: [
            "Use the site for learning, evaluation, and non-commercial research aligned with the dataset licenses. Do not attempt to disrupt the service, scrape it in a way that harms availability, misuse any local demo against others, or present this reproduction as the official SubspaceAD project or as an endorsement by the paper authors.",
            "If you republish numbers or figures from this site, credit this reproduction and the original paper, and respect MVTec-AD and VisA licensing for imagery.",
          ],
        },
        {
          title: "Intellectual property",
          body: [
            "The paper, method name, and official code belong to their respective owners. Site copy, layout, and this reproduction’s source code are provided under the license in the repository unless a file says otherwise.",
            "MVTec-AD imagery is CC BY-NC-SA 4.0 (non-commercial research). VisA imagery is CC BY 4.0. Do not assume you may use those images commercially because they appear here.",
          ],
        },
        {
          title: "No warranty",
          body: [
            "Content is provided “as is” for demonstration and research communication. Benchmark numbers are measured runs of this reproduction; they may differ from the paper or from your own hardware. The site and demo are not medical, safety, or production anomaly-detection systems.",
            "We do not warrant uninterrupted availability, absolute accuracy of every displayed figure, or fitness for a particular purpose.",
          ],
        },
        {
          title: "Local live demo",
          body: [
            "When you run the GPU demo from the repository on your own machine, you are responsible for that environment: dependencies, data you load, uploads, and any models or outputs you generate. The hosted static site does not process your private images.",
          ],
        },
        {
          title: "Limitation of liability",
          body: [
            "To the fullest extent permitted by law, the site maintainer is not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising from use of the site, the reproduction code, or reliance on displayed results.",
          ],
        },
        {
          title: "External links",
          body: [
            "Links to arXiv, GitHub, dataset pages, and other third parties are for convenience. We do not control those services and are not responsible for their content or policies.",
          ],
        },
        {
          title: "Changes",
          body: [
            "These terms may be updated. The “Last updated” date will change when they do. Continued use after an update constitutes acceptance of the revised terms.",
          ],
        },
        {
          title: "Contact",
          body: [
            <>
              Questions about these terms:{" "}
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
                Chinmoy-04/Subspacead
              </a>
              . Context for the project lives on the{" "}
              <Link href="/about" className="text-foreground underline underline-offset-4">
                About
              </Link>{" "}
              page.
            </>,
          ],
        },
      ]}
    />
  );
}
