import type { Metadata } from "next";
import { GalleryView } from "@/components/gallery/gallery-view";

export const metadata: Metadata = {
  title: "Gallery",
  description: "SubspaceAD success and failure cases from the full MVTec-AD and VisA benchmark run.",
};

export default function GalleryPage() {
  return <GalleryView />;
}
