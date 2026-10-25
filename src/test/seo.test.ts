import { describe, expect, it } from "vitest";
import { absoluteUrl, brandName, jsonLd, pageHead, siteOrigin } from "@/lib/seo";

describe("public metadata", () => {
  it("resolves canonical and social images to the configured HTTPS origin", () => {
    const head = pageHead({
      title: brandName,
      description: "Nigerian store",
      path: "/products/eco",
    });
    expect(head.links).toEqual([{ rel: "canonical", href: `${siteOrigin}/products/eco` }]);
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: `${siteOrigin}/brand/social-share.jpg`,
    });
    expect(head.meta).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
    expect(absoluteUrl("/brand/logo.png")).toMatch(/^https:\/\//);
  });
  it("does not publish canonical links for private pages", () => {
    const head = pageHead({
      title: "Admin",
      description: "Private administration",
      path: "/admin",
      noindex: true,
    });
    expect(head.links).toEqual([]);
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex, nofollow" });
  });
  it("escapes HTML delimiters in structured data", () => {
    const payload = { name: "</script><script>fixture</script>" };
    expect(jsonLd(payload)).not.toContain("<");
    expect(JSON.parse(jsonLd(payload))).toEqual(payload);
  });
});
