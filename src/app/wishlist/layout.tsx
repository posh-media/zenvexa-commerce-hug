import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivateMetadata("Wishlist");

export default function WishlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
