import { expect, it } from "vitest";
import { products, categories, locations } from "@/lib/commerce";
import {
  seedProducts,
  planCatalogue,
  categoryKey,
  catalogueMigration,
} from "../../functions/catalogue";

const seeded = seedProducts(products);
const source: { path: string; data: Record<string, unknown> }[] = [
  ...seeded.map((data) => ({ path: `products/${String(data["id"])}`, data })),
  ...categories.slice(1).map((name) => ({
    path: `categories/${categoryKey(name)}`,
    data: { name, description: "", image: "", featured: false },
  })),
  ...Object.entries(locations).map(([state, value]) => ({
    path: `deliveryZones/${categoryKey(state)}`,
    data: { ...value, state, active: true },
  })),
];
it("preserves all 50 source IDs/SKUs, categories and explicit seed-review provenance", () => {
  expect(seeded).toHaveLength(50);
  expect(new Set(seeded.map((p) => p["category"])).size).toBe(5);
  expect(seeded.map((p) => p["id"])).toEqual(products.map((p) => p.id));
  expect(seeded.map((p) => p["sku"])).toEqual(products.map((p) => p.sku));
  for (const p of seeded) {
    expect(p["currency"]).toBe("NGN");
    expect(p["reviewSource"]).toBe("seed");
    expect(p["images"]).toEqual([p["image"]]);
  }
});
it("plans missing records while preserving legitimate edited prices, stock, images and inactive state", () => {
  const original = source[0]!;
  const edited = {
    ...original.data,
    price: 1500000,
    oldPrice: 1600000,
    stock: 7,
    image: "https://example.test/product.webp",
    images: ["https://example.test/product.webp"],
    active: false,
  };
  const plan = planCatalogue(source, [{ path: original.path, data: edited }]);
  const change = plan.changes.find((r) => r.path === original.path)!;
  expect(plan.issues).toEqual([]);
  for (const field of ["price", "oldPrice", "stock", "image", "images", "active"])
    expect(change.data[field]).toBeUndefined();
  expect(planCatalogue(source, source).summary.create).toBe(0);
  const invalidComparison = planCatalogue(source, [
    { path: original.path, data: { ...edited, oldPrice: -1 } },
  ]);
  expect(invalidComparison.changes[0]!.data["oldPrice"]).toBe(edited.price);
});
it("flags duplicate existing SKUs and quarantines invalid stock instead of replenishing it", () => {
  const original = source[0]!;
  const plan = planCatalogue(source, [
    { path: original.path, data: { ...original.data, stock: -1 } },
    { path: "products/other", data: { sku: original.data["sku"] } },
  ]);
  expect(plan.issues.length).toBeGreaterThan(0);
  expect(plan.changes[0]!.data["stock"]).toBe(0);
  expect(plan.changes[0]!.data["active"]).toBe(false);
});
it.skipIf(!["export", "dry-run", "apply"].includes(process.env["ZENVEXA_CATALOGUE_MODE"] ?? ""))(
  "exports or runs the explicitly selected guarded catalogue migration",
  async () => {
    const mode = process.env["ZENVEXA_CATALOGUE_MODE"];
    if (mode === "export") {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        "catalogue-manifest.json",
        JSON.stringify({ products: seeded, source }, null, 2),
      );
      return;
    }
    await catalogueMigration(
      source,
      mode === "apply" ? "apply" : "dry-run",
      process.env["ZENVEXA_APPROVED_PLAN_HASH"],
    );
  },
);
