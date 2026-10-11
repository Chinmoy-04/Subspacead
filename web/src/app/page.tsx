import { ArrowUpRightIcon } from "lucide-react";
import { CaseGallery, CaseGalleryIntro } from "@/components/home/case-gallery";
import { CategoryMarquee } from "@/components/home/category-marquee";
import { Faq } from "@/components/home/faq";
import { MethodStack } from "@/components/home/method-stack";
import { Outro } from "@/components/home/outro";
import { Readings } from "@/components/home/readings";
import { SpecimenPanel } from "@/components/home/specimen-panel";
import { PillButton } from "@/components/site/magnetic";
import { PAPER_URL } from "@/components/site/nav-links";
import { Reveal, RevealWords } from "@/components/site/reveal";

export default function Home() {
  return (
    <>
      <section className="container-site pt-10 pb-16 md:pt-16 md:pb-24">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-7 text-center">
          <h1 className="text-display">
            <RevealWords text="SubspaceAD" />
          </h1>
          <p className="text-subtitle max-w-[26ch] text-balance text-muted-foreground">
            Training-free <span className="whitespace-nowrap">few-shot</span> anomaly detection, reproduced and measured.
          </p>
          <p className="max-w-xl text-[0.9375rem] text-muted-foreground text-pretty">
            An independent reproduction of Lendering, Akdag &amp; Bondarev (arXiv:2602.23013), run on the full MVTec-AD
            and VisA protocol.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <PillButton href="/demo" size="lg" data-cursor="Try it">
              Live demo
            </PillButton>
            <PillButton href={PAPER_URL} external variant="outline" size="lg">
              Read the paper <ArrowUpRightIcon className="size-4" aria-hidden />
            </PillButton>
          </div>
        </div>
      </section>

      <section className="container-site" aria-label="Specimen">
        <SpecimenPanel />
      </section>

      <section className="container-site py-28 md:py-40">
        <Reveal>
          <Readings />
        </Reveal>
      </section>

      <section className="pb-12 md:pb-20" aria-label="Method">
        <MethodStack />
      </section>

      <section className="border-y border-border py-12 md:py-16" aria-label="Categories evaluated">
        <CategoryMarquee />
      </section>

      <section className="inverse py-28 md:py-40">
        <div className="container-site flex flex-col gap-16 md:gap-24">
          <Reveal>
            <CaseGalleryIntro />
          </Reveal>
          <CaseGallery />
        </div>
      </section>

      <section className="container-narrow flex flex-col gap-14 py-28 md:py-40">
        <Reveal>
          <h2 className="text-title max-w-[14ch] text-balance">Questions a reviewer asks.</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <Faq />
        </Reveal>
      </section>

      <Outro />
    </>
  );
}
