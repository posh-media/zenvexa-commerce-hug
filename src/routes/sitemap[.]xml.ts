import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/seo";
import { getSitemapProducts } from "@/lib/public-catalogue";
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const ids = await getSitemapProducts();
          const urls = [
            absoluteUrl("/"),
            ...ids.map((id) => absoluteUrl(`/products/${encodeURIComponent(id)}`)),
          ];
          const escape = (v: string) =>
            v
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;")
              .replaceAll('"', "&quot;");
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escape(url)}</loc></url>`).join("")}</urlset>`,
            {
              headers: {
                "Content-Type": "application/xml; charset=utf-8",
                "Cache-Control": "public, max-age=300",
              },
            },
          );
        } catch {
          return new Response("Sitemap temporarily unavailable; catalogue could not be verified.", {
            status: 503,
            headers: { "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
