import type { Product as ProductView } from "@/lib/data";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EmptyBoxIllustration,
  ErrorIllustration,
} from "@/components/ui/illustrations";
import { ProductRail } from "@/components/commerce/product-card";

export function CatalogEmpty({
  title = "Nothing here yet",
  description = "No products in the catalogue match this section right now.",
  compact = true,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <EmptyState
      illustration={<EmptyBoxIllustration />}
      title={title}
      description={description}
      compact={compact}
    />
  );
}

export function CatalogError({
  compact = true,
}: {
  compact?: boolean;
}) {
  return (
    <EmptyState
      illustration={<ErrorIllustration />}
      title="We couldn’t load the catalogue"
      description="The product service is unavailable right now. Refresh the page to try again."
      compact={compact}
      actions={
        <ButtonLink href="/" variant="outline">
          Reload
        </ButtonLink>
      }
    />
  );
}

/** Product rail with built-in empty and error handling. */
export function CatalogRail({
  items,
  failed = false,
  emptyDescription,
}: {
  items: ProductView[];
  failed?: boolean;
  emptyDescription?: string;
}) {
  if (failed) return <CatalogError />;
  if (!items.length) return <CatalogEmpty description={emptyDescription} />;
  return <ProductRail items={items} />;
}
