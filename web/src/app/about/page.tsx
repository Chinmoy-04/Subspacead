import type { Metadata } from "next";
import { AboutView } from "@/components/about/about-view";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why this SubspaceAD reproduction exists, what the paper proposes, and how our runs compare — in plain language.",
};

export default function AboutPage() {
  return <AboutView />;
}
