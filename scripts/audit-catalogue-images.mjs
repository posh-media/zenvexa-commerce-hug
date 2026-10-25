import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
const { products } = JSON.parse(await readFile("catalogue-manifest.json", "utf8"));
const checks = new Map();
const thumbnails = [];
for (const p of products) {
  const original = p.originalImage;
  if (checks.has(original)) continue;
  const url = original.startsWith("https://")
    ? original
    : original.startsWith("/__l5e/")
      ? `https://zenvexa-commerce-hug.vercel.app${original}`
      : null;
  if (!url) {
    checks.set(original, {
      source: original,
      status: p.id === "eco" ? "local-reviewed" : "unresolved",
    });
    continue;
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const contentType = response.headers.get("content-type") ?? "";
    checks.set(original, { source: url, status: response.status, contentType });
    if (response.ok && contentType.startsWith("image/")) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 10000000) continue;
      const image = await sharp(bytes)
        .resize(240, 170, { fit: "contain", background: "#ffffff" })
        .jpeg()
        .toBuffer();
      const label = Buffer.from(
        `<svg width="240" height="40"><rect width="240" height="40" fill="white"/><text x="8" y="24" font-size="14">${p.id}: ${p.title.slice(0, 24).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</text></svg>`,
      );
      thumbnails.push({ image, label });
    }
  } catch (e) {
    checks.set(original, { source: url, status: "unreachable", reason: e.message });
  }
}
if (thumbnails.length) {
  const width = 4 * 240,
    height = Math.ceil(thumbnails.length / 4) * 210;
  const compose = [];
  thumbnails.forEach((t, i) => {
    const left = (i % 4) * 240,
      top = Math.floor(i / 4) * 210;
    compose.push({ input: t.image, left, top }, { input: t.label, left, top: top + 170 });
  });
  await sharp({ create: { width, height, channels: 3, background: "#dddddd" } })
    .composite(compose)
    .jpeg({ quality: 90 })
    .toFile("catalogue-image-contact-sheet.jpg");
}
const report = products.map((p) => ({
  id: p.id,
  title: p.title,
  original: p.originalImage,
  check: checks.get(p.originalImage),
  selected: p.image,
  semanticStatus: p.imageStatus,
  notes: p.imageNotes,
}));
await writeFile(
  "catalogue-image-audit.json",
  JSON.stringify(
    {
      checkedProducts: report.length,
      verifiedProductPhotos: report.filter((p) => p.semanticStatus === "verified").length,
      unresolvedProductPhotos: report.filter((p) => p.semanticStatus !== "verified").length,
      products: report,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    checkedProducts: report.length,
    httpSources: checks.size,
    verifiedProductPhotos: report.filter((p) => p.semanticStatus === "verified").length,
    unresolvedProductPhotos: report.filter((p) => p.semanticStatus !== "verified").length,
  }),
);
