import type { Metadata } from "next";
import { AblationsView } from "@/components/ablations/ablations-view";

export const metadata: Metadata = {
  title: "Ablations",
  description: "SubspaceAD sensitivity to layer aggregation, PCA threshold, backbone size, resolution and 0-shot batching.",
};

export default function AblationsPage() {
  return <AblationsView />;
}
