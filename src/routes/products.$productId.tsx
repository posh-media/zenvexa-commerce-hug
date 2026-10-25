import { useState } from "react";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { getPublicProduct } from "@/lib/public-catalogue";
import { pageHead, absoluteUrl, jsonLd, brandName } from "@/lib/seo";
import { StoreProvider, useStore } from "@/components/zenvexa/store-context";
import { Header, Footer, Overlays } from "@/components/zenvexa/storefront";
import { FirebaseAccount } from "@/components/zenvexa/firebase-commerce";
import { ProductImage } from "@/components/zenvexa/product-image";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { money, type Product } from "@/lib/commerce";
export const Route = createFileRoute("/products/$productId")({
  loader: async ({ params }) => {
    const product = await getPublicProduct({ data: { id: params.productId } });
    if (!product) throw notFound();
    return product;
  },
  head: ({ loaderData: product }) => {
    if (!product)
      return pageHead({
        title: `Product unavailable — ${brandName}`,
        description: "This product is unavailable.",
        noindex: true,
      });
    const head = pageHead({
      title: `${product.title} — ${brandName}`,
      description: (product.shortDescription || product.description).slice(0, 160),
      path: `/products/${product.id}`,
    });
    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description: product.description,
      sku: product.sku,
      ...(product.imageStatus === "verified" ? { image: absoluteUrl(product.image) } : {}),
      offers: {
        "@type": "Offer",
        url: absoluteUrl(`/products/${product.id}`),
        priceCurrency: "NGN",
        price: product.price,
        availability:
          product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    };
    return { ...head, scripts: [{ type: "application/ld+json", children: jsonLd(schema) }] };
  },
  component: ProductPage,
});
function ProductPage() {
  const product = Route.useLoaderData();
  return (
    <StoreProvider>
      <Header />
      <FirebaseAccount />
      <Detail key={product.id} product={product} />
      <Footer />
      <Overlays />
      <Toaster richColors />
    </StoreProvider>
  );
}
function Detail({ product: p }: { product: Product }) {
  const s = useStore();
  const [image, setImage] = useState(p.image);
  const images = Array.isArray(p.images) && p.images.length ? p.images : [p.image];
  return (
    <main className="container-page view-page">
      <Link to="/">Back to catalogue</Link>
      <div className="quick-layout view-section">
        <div>
          <ProductImage
            src={image}
            alt={p.title}
            width={600}
            height={600}
            className="quick-image"
          />
          <div className="flex gap-2 flex-wrap">
            {images.map((url, i) => (
              <Button
                key={i}
                variant="outline"
                onClick={() => setImage(url)}
                aria-label={`Product image ${i + 1}`}
              >
                <ProductImage src={url} alt="" width={48} height={48} />
              </Button>
            ))}
          </div>
          {p.imageStatus === "missing" && (
            <p>
              Exact product photography is unavailable. The illustration is a missing-image
              indicator, not the product.
            </p>
          )}
        </div>
        <div>
          <h1 className="page-title">{p.title}</h1>
          <p>{p.description}</p>
          <p className="product-prices">
            <strong>{money(p.price)}</strong>
            <del>{money(p.oldPrice)}</del>
          </p>
          <p>
            SKU: {p.sku} · {p.stock} available
          </p>
          <p>
            {p.rating} / 5 · {p.reviews}{" "}
            {p.reviewSource === "seed" ? "seed ratings, not verified customer reviews" : "ratings"}
          </p>
          <ul>
            {p.specs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
          <Button disabled={p.stock <= 0 || s.backendLoading} onClick={() => s.add(p)}>
            Add to Hug Bag
          </Button>
        </div>
      </div>
    </main>
  );
}
