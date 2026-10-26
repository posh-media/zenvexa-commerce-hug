import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivateMetadata("Orders");

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
