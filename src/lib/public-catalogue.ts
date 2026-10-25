import { createServerFn } from "@tanstack/react-start";
export const getPublicProduct = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { loadProduct } = await import("./public-catalogue.server");
    return loadProduct(data.id);
  });
export const getSitemapProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { publicProductIds } = await import("./public-catalogue.server");
  return publicProductIds();
});
