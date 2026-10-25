import { expect, it } from "vitest";
import { products, categories, locations } from "@/lib/commerce";
import { seedProducts } from "../../functions/catalogue";

it.skipIf(process.env["ZENVEXA_SEED"] !== "emulator")(
  "creates missing emulator catalogue documents only; never imports demo orders",
  async () => {
    expect(process.env["FIRESTORE_EMULATOR_HOST"]).toMatch(/^(localhost|127\.0\.0\.1):\d+$/);
    const { seedEmulator } = await import("../../functions/seed");
    const { createHash } = await import("node:crypto");
    const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 24);
    const records: [string, object][] = [
      ...seedProducts(products).map(
        (product) => [`products/${String(product["id"])}`, product] as [string, object],
      ),
      ...categories
        .slice(1)
        .map((name) => [`categories/${hash(name)}`, { name }] as [string, object]),
      ...Object.entries(locations).map(
        ([state, location]) =>
          [`deliveryZones/${hash(state)}`, { ...location, state, active: true }] as [
            string,
            object,
          ],
      ),
    ];
    expect(await seedEmulator(records)).toBeGreaterThanOrEqual(50);
  },
);
