import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/site/legal-doc";
import { PAPER_URL, REPO_URL } from "@/components/site/nav-links";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How the SubspaceAD reproduction site handles information, local storage, and third-party links.",
};

const UPDATED = "2026-10-16";

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy policy"
      updated={UPDATED}
      related={{ href: "/terms", label: "Terms of use" }}
      lede={
        <>
          This site is a personal research showcase for an independent SubspaceAD reproduction. It is built to show
          measured results, not to collect people.
        </>
      }
      sections={[
        {
          title: "Who runs this site",
          body: [
            <>
              The site is maintained by the author of this reproduction (
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
                Chinmoy-04/Subspacead
              </a>
              ). It is not the official project of the paper authors (Lendering, Akdag &amp; Bondarev).
            </>,
          ],
        },
        {
          title: "What this site does",
          body: [
            "Most pages are static: bundled benchmark tables, ablations, method notes, and gallery figures. The interactive scoring demo that uses a GPU is intended to run on your own machine when you clone the repository. The hosted site does not run that model for you.",
          ],
        },
        {
          title: "Information we collect",
          body: [
            "We do not ask you to create an account, and we do not sell personal data.",
            "Like most websites, the hosting provider may process standard technical request data such as IP address, user agent, timestamps, and requested URLs in server or CDN logs. That data is used to operate, secure, and debug the site. Retention follows the host’s defaults.",
            "If you open issues or contact us through GitHub, that conversation is governed by GitHub’s own privacy policy.",
          ],
        },
        {
          title: "Cookies and local storage",
          body: [
            "This site does not use advertising cookies or third-party tracking pixels that we control.",
            "Your theme preference (light or dark) is stored in your browser’s localStorage so the choice can persist between visits. You can clear it anytime by clearing site data in your browser.",
          ],
        },
        {
          title: "Third-party services",
          body: [
            <>
              Pages link out to{" "}
              <a href={PAPER_URL} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
                arXiv
              </a>
              , GitHub, and other external resources. Those sites have their own privacy practices. Following a link
              leaves this site.
            </>,
            "Deployment and delivery may use a cloud host and CDN (for example Vercel). Their infrastructure may process the technical logs described above.",
          ],
        },
        {
          title: "Datasets and imagery",
          body: [
            "Gallery and demo imagery comes from public research datasets. MVTec-AD is licensed CC BY-NC-SA 4.0 for non-commercial research. VisA is CC BY 4.0. Those licenses govern reuse of the images themselves; they are not a grant of rights beyond what the dataset owners provide.",
          ],
        },
        {
          title: "Children",
          body: [
            "This site is aimed at researchers, engineers, and portfolio visitors. It is not directed at children under 13, and we do not knowingly collect personal information from them.",
          ],
        },
        {
          title: "Changes",
          body: [
            "If this policy changes in a meaningful way, the “Last updated” date at the top of the page will change. Continued use after an update means you have had a chance to read the new version.",
          ],
        },
        {
          title: "Contact",
          body: [
            <>
              Questions about privacy on this site: open an issue or discussion on{" "}
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
                the reproduction repository
              </a>
              , or use the contact path listed there.
            </>,
            <>
              For dataset licensing questions, refer to the MVTec-AD and VisA project pages. For the paper itself, see{" "}
              <Link href="/about" className="text-foreground underline underline-offset-4">
                About
              </Link>{" "}
              and the arXiv abstract.
            </>,
          ],
        },
      ]}
    />
  );
}
