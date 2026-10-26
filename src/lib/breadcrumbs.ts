import type { Crumb as UiCrumb } from "@/components/ui/breadcrumb";
import { breadcrumbJsonLd } from "@/lib/seo";

export type Crumb = {
  label: string;
  href?: string;
};

export function buildBreadcrumbs(crumbs: Crumb[]): UiCrumb[] {
  return crumbs.map((crumb) => ({
    label: crumb.label,
    href: crumb.href,
  }));
}

export function homeCrumb(): Crumb {
  return { label: "Home", href: "/" };
}

export function catalogCrumbs(parts: Crumb[]): Crumb[] {
  return [homeCrumb(), ...parts];
}

export function productDetailCrumbs(input: {
  categoryName?: string;
  categorySlug?: string;
  productName: string;
}): Crumb[] {
  const crumbs: Crumb[] = [homeCrumb()];
  if (input.categorySlug && input.categoryName) {
    crumbs.push({
      label: input.categoryName,
      href: `/category/${input.categorySlug}`,
    });
  }
  crumbs.push({ label: input.productName });
  return crumbs;
}

export function searchCrumbs(query?: string): Crumb[] {
  return catalogCrumbs([
    { label: "Search", href: "/search" },
    ...(query ? [{ label: `"${query}"` }] : []),
  ]);
}

export function accountCrumbs(...parts: Crumb[]): Crumb[] {
  return [homeCrumb(), ...parts];
}

/** UI crumbs + JSON-LD for SEO pages. */
export function breadcrumbsWithJsonLd(crumbs: Crumb[]) {
  const items = buildBreadcrumbs(crumbs);
  const linked = crumbs.filter(
    (crumb): crumb is Crumb & { href: string } => Boolean(crumb.href),
  );
  // Include final crumb as current page using last href or path guess.
  const jsonLd = breadcrumbJsonLd(
    linked.map((crumb) => ({
      name: crumb.label,
      path: crumb.href,
    })),
  );
  return { items, jsonLd };
}
