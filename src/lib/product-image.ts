export function isRealProductImage(src?: string | null): src is string {
  if (!src?.trim()) return false;
  return !/missing\.svg|placeholder|no-image|image-not-found/i.test(src.trim());
}

export function usableProductImages(images?: Array<string | null | undefined>) {
  return (images ?? []).filter(isRealProductImage);
}

export function hasRealProductImage(product: {
  thumbnail?: string;
  images?: string[];
}) {
  return isRealProductImage(product.thumbnail) || usableProductImages(product.images).length > 0;
}

export function prioritizeRealImages<T extends { thumbnail?: string; images?: string[] }>(
  items: T[],
) {
  const withImages: T[] = [];
  const withoutImages: T[] = [];
  for (const item of items) {
    (hasRealProductImage(item) ? withImages : withoutImages).push(item);
  }
  return [...withImages, ...withoutImages];
}
