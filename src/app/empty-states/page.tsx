import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/seo";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EmptyBoxIllustration,
  EmptyCartIllustration,
  EmptyHeartIllustration,
  ErrorIllustration,
  NoBellIllustration,
  NoResultsIllustration,
  NotFoundIllustration,
  SuccessIllustration,
} from "@/components/ui/illustrations";

export const metadata: Metadata = buildPrivateMetadata("Empty states");

export default function EmptyStatesPage() {
  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Design system", href: "/components" },
          { label: "Empty states" },
        ]}
        title="Empty states"
        description="Every zero-data screen in the product, plus the illustration set they draw from."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <EmptyState
          illustration={<EmptyCartIllustration />}
          title="Your cart is empty"
          description="Add a product and it will show up here. Items stay in your cart for 30 days."
          actions={
            <>
              <ButtonLink href="/products">Start shopping</ButtonLink>
              <ButtonLink href="/deals" variant="outline">
                See deals
              </ButtonLink>
            </>
          }
        />
        <EmptyState
          illustration={<EmptyHeartIllustration />}
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it and get told when the price drops."
          actions={<ButtonLink href="/products">Browse products</ButtonLink>}
        />
        <EmptyState
          illustration={<EmptyBoxIllustration />}
          title="No orders yet"
          description="When you place your first order it will appear here with live tracking."
          actions={<ButtonLink href="/products">Find something to buy</ButtonLink>}
        />
        <EmptyState
          illustration={<NoBellIllustration />}
          title="No notifications"
          description="You are all caught up. Order and delivery updates will land here."
          actions={
            <ButtonLink href="/settings" variant="outline">
              Notification settings
            </ButtonLink>
          }
        />
        <EmptyState
          illustration={<NoResultsIllustration />}
          title="No results found"
          description="Nothing matched that search. Try fewer words or check the spelling."
          actions={
            <>
              <ButtonLink href="/products">Browse all products</ButtonLink>
              <ButtonLink href="/help" variant="outline">
                Ask support
              </ButtonLink>
            </>
          }
        />
        <EmptyState
          illustration={<ErrorIllustration />}
          title="Something went wrong"
          description="We could not load this page. It is usually temporary — try again in a moment."
          actions={
            <>
              <ButtonLink href="/">Try again</ButtonLink>
              <ButtonLink href="/help" variant="outline">
                Contact support
              </ButtonLink>
            </>
          }
        />
      </div>

      <section className="pt-16 sm:pt-20">
        <h2 className="mb-6 text-2xl font-semibold tracking-[-0.025em] text-ink">
          Illustration set
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Success", node: <SuccessIllustration /> },
            { label: "404", node: <NotFoundIllustration /> },
            { label: "Error", node: <ErrorIllustration /> },
            { label: "Empty box", node: <EmptyBoxIllustration /> },
            { label: "Empty cart", node: <EmptyCartIllustration /> },
            { label: "Empty wishlist", node: <EmptyHeartIllustration /> },
            { label: "No results", node: <NoResultsIllustration /> },
            { label: "No notifications", node: <NoBellIllustration /> },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-white p-5"
            >
              <div className="w-full max-w-[160px]">{item.node}</div>
              <p className="text-[13px] font-medium text-ink">{item.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
