import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivateMetadata("Order confirmed");

export default function OrderSuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
