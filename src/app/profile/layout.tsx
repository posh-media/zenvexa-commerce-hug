import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivateMetadata(
  "Profile",
  "Manage your Zenvexa account.",
);

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
