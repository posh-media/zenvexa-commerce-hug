import { createFileRoute } from "@tanstack/react-router";
import { StoreProvider, useStore } from "@/components/zenvexa/store-context";
import { Header, Shop, Footer, Overlays } from "@/components/zenvexa/storefront";
import { Checkout, Orders } from "@/components/zenvexa/views";
import { Toaster } from "@/components/ui/sonner";
import { FirebaseAccount } from "@/components/zenvexa/firebase-commerce";
import { pageHead, brandName, tagline } from "@/lib/seo";
export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: `${brandName} — ${tagline}`,
      description:
        "Browse phones, home and power essentials, Nigerian fashion, pantry products and personal care at Zenvexa. Prices in naira; delivery to supported Nigerian zones.",
    }),
  component: Index,
});
function Experience() {
  const s = useStore();
  return (
    <>
      <Header />
      <FirebaseAccount />
      {s.view === "shop" ? <Shop /> : s.view === "checkout" ? <Checkout /> : <Orders />}
      <Footer />
      <Overlays />
      <Toaster position="bottom-right" richColors />
    </>
  );
}
function Index() {
  return (
    <StoreProvider>
      <Experience />
    </StoreProvider>
  );
}
