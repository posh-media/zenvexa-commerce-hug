import type { Product } from "@/types/product";
import {
  getBestSellers,
  getFlashSaleProducts,
  getLatestProducts,
  getRelatedProducts,
  getTrendingProducts,
  getYouMayAlsoLike,
} from "@/services/products.service";

/**
 * Shared recommendation helpers. "Frequently viewed together" and full
 * personalization are prepared as stubs until analytics events accumulate.
 */
export async function getRecommendationsForProduct(
  product: Product,
  options?: { related?: number; alsoLike?: number; excludeIds?: Set<string> },
) {
  const related = await getRelatedProducts(product, options?.related ?? 4);
  const relatedIds = new Set(options?.excludeIds);
  for (const item of related) relatedIds.add(item.id);
  const alsoLike = await getYouMayAlsoLike(
    product,
    options?.alsoLike ?? 4,
    relatedIds,
  );
  return { related, alsoLike };
}

export async function getDiscoveryRails(size = 4) {
  const [trending, flash, latest, bestsellers] = await Promise.all([
    getTrendingProducts(size),
    getFlashSaleProducts(size),
    getLatestProducts(size),
    getBestSellers(size),
  ]);
  return { trending, flash, latest, bestsellers };
}

/** Placeholder for future co-view / purchase graph recommendations. */
export async function getFrequentlyViewedTogether(
  productId: string,
  max = 4,
): Promise<Product[]> {
  void productId;
  void max;
  return [];
}

/** Placeholder for future personalized ranking from user activity. */
export async function getPersonalizedRecommendations(
  userId: string,
  max = 4,
): Promise<Product[]> {
  void userId;
  void max;
  return [];
}
