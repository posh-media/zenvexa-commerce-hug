import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivateMetadata("Addresses");

export default function AddressesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
