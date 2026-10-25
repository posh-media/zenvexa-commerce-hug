export const siteOrigin = (
  import.meta.env["VITE_PUBLIC_SITE_URL"] || "https://www.zenvexacommerce.com"
).replace(/\/$/, "");
export const brandName = "Zenvexa Commerce Hug";
export const tagline = "Everything Naija Needs, Delivered with a Warm Hug";
export function absoluteUrl(path: string) {
  const origin = new URL(siteOrigin);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/")
    throw new Error("Configure a valid HTTPS canonical origin.");
  return new URL(path, origin).toString();
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
export function pageHead({
  title,
  description,
  path = "/",
  noindex = false,
}: {
  title: string;
  description: string;
  path?: string;
  noindex?: boolean;
}) {
  const image = absoluteUrl("/brand/social-share.jpg");
  const url = absoluteUrl(path);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: noindex ? "noindex, nofollow" : "index, follow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: brandName },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1080" },
      { property: "og:image:height", content: "602" },
      { property: "og:image:alt", content: `${brandName} — ${tagline}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
    links: noindex ? [] : [{ rel: "canonical", href: url }],
  };
}
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: brandName,
  url: absoluteUrl("/"),
  logo: absoluteUrl("/brand/logo.png"),
  slogan: tagline,
};
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: brandName,
  url: absoluteUrl("/"),
  inLanguage: "en-NG",
  description: tagline,
};
