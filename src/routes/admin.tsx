import { createFileRoute } from "@tanstack/react-router";
import { StoreProvider } from "@/components/zenvexa/store-context";
import { AdminGate } from "@/components/zenvexa/admin";
import { Toaster } from "@/components/ui/sonner";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/admin")({
  head: () =>
    pageHead({
      title: "Admin Portal — Zenvexa Commerce Hug",
      description: "Staff-only Zenvexa administration.",
      path: "/admin",
      noindex: true,
    }),
  component: () => (
    <StoreProvider>
      <AdminGate />
      <Toaster position="bottom-right" richColors />
    </StoreProvider>
  ),
});
