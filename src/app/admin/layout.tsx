import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Admin",
  description: "Zenvexa administration dashboard",
  ...noIndexMetadata,
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
