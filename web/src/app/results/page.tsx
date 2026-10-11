import type { Metadata } from "next";
import { ResultsView } from "@/components/results/results-view";

export const metadata: Metadata = {
  title: "Results",
  description: "SubspaceAD reproduction against the paper's Table 1 on MVTec-AD and VisA, with per-category scores.",
};

export default function ResultsPage() {
  return <ResultsView />;
}
