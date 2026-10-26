import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/cart",
          "/checkout",
          "/profile",
          "/addresses",
          "/orders",
          "/order-success",
          "/wishlist",
          "/notifications",
          "/settings",
          "/track-order",
          "/login",
          "/signup",
          "/forgot-password",
          "/payments",
          "/payments/",
          "/api/",
          "/components",
          "/empty-states",
          "/loading-states",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}
