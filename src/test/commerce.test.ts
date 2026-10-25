import { describe, it, expect } from "vitest";
import {
  products,
  locations,
  promoDiscount,
  cartSubtotal,
  orderTotal,
  money,
} from "@/lib/commerce";
describe("Nigerian commerce rules", () => {
  it("HUG10 takes ten percent off merchandise", () => {
    expect(promoDiscount("HUG10", 985000)).toBe(98500);
  });
  it("NAIJA5K takes ₦5,000 off orders above ₦50,000", () => {
    expect(promoDiscount("NAIJA5K", 50001)).toBe(5000);
    expect(promoDiscount("NAIJA5K", 50000)).toBe(0);
    expect(promoDiscount("NAIJA5K", 49500)).toBe(0);
  });
  it("calculates quantity subtotal, discount and selected delivery", () => {
    const cart = [{ product: products[2]!, quantity: 2 }];
    expect(cartSubtotal(cart)).toBe(157000);
    expect(orderTotal(cart, "Lagos", "HUG10")).toBe(142800);
    expect(orderTotal(cart, "Kano", "HUG10")).toBe(144500);
    expect(orderTotal([], "Lagos")).toBe(0);
  });
  it("keeps all twelve requested selling and old prices", () => {
    expect(products.slice(0, 12).map((p) => [p.price, p.oldPrice])).toEqual([
      [985000, 1120000],
      [545000, 590000],
      [78500, 85000],
      [94000, 110000],
      [42000, 52000],
      [36500, 44000],
      [88000, 105000],
      [28500, 34000],
      [890000, 970000],
      [19500, 22000],
      [65000, 78000],
      [46000, 55000],
    ]);
  });
  it("uses Nigerian Naira with no decimal places", () => {
    expect(money(985000)).toBe("₦985,000");
  });
  it("sets Nigerian delivery fees within ₦1,500–₦3,200", () => {
    expect(Object.keys(locations)).toEqual([
      "Lagos",
      "Abuja (FCT)",
      "Rivers",
      "Oyo",
      "Kano",
      "Enugu",
    ]);
    expect(Math.min(...Object.values(locations).map((l) => l.fee))).toBe(1500);
    expect(Math.max(...Object.values(locations).map((l) => l.fee))).toBe(3200);
  });
});
import { categories, BUDGET_MAX, advanceOrder } from "@/lib/commerce";
describe("Expanded catalog and admin rules", () => {
  it("has 50 products, 10 per category, with unique ids", () => {
    expect(products).toHaveLength(50);
    for (const c of categories.slice(1))
      expect(products.filter((p) => p.category === c)).toHaveLength(10);
    expect(new Set(products.map((p) => p.id)).size).toBe(50);
  });
  it("keeps ratings between 4.5 and 5.0 and 3–4 specs", () => {
    for (const p of products) {
      expect(p.rating).toBeGreaterThanOrEqual(4.5);
      expect(p.rating).toBeLessThanOrEqual(5);
      expect(p.specs.length).toBeGreaterThanOrEqual(3);
      expect(p.specs.length).toBeLessThanOrEqual(4);
    }
  });
  it("shows every product within the default budget", () => {
    expect(Math.max(...products.map((p) => p.price))).toBeLessThanOrEqual(BUDGET_MAX);
  });
  it("advances an order one step and stops at delivered", () => {
    expect(advanceOrder({ step: 1, status: "x" }).step).toBe(2);
    expect(advanceOrder({ step: 4, status: "Delivered" }).step).toBe(4);
  });
});
