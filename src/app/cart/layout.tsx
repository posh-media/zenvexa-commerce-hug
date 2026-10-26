import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivateMetadata(
  "Cart",
  "Your Zenvexa shopping cart.",
);

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
