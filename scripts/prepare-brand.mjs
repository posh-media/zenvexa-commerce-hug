import sharp from "sharp";
import { mkdir } from "node:fs/promises";

await mkdir("public/brand", { recursive: true });
await mkdir("public/catalog", { recursive: true });
for (const name of ["Zenvexa logo.jpeg", "Zenvexa Social Share Image.jpeg"]) {
  const meta = await sharp(name).metadata();
  console.log(
    JSON.stringify({ file: name, width: meta.width, height: meta.height, format: meta.format }),
  );
}
await sharp("Zenvexa logo.jpeg")
  .trim({ background: "#ffffff", threshold: 25 })
  .resize({ width: 256, height: 256, fit: "contain", background: "#ffffff" })
  .png()
  .toFile("public/brand/logo.png");
await sharp("public/brand/logo.png").resize(64, 64).png().toFile("public/brand/favicon.png");
await sharp("Zenvexa Social Share Image.jpeg")
  .jpeg({ quality: 95 })
  .toFile("public/brand/social-share.jpg");
