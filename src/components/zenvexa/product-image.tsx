import { useState, type ImgHTMLAttributes } from "react";

type ProductImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: unknown };
const placeholder = "/catalog/missing.svg";

function imageSource(value: unknown): string {
  if (typeof value !== "string") return placeholder;
  const source = value.trim();
  if (!source || /[\s\\]/.test(source) || Array.from(source).some((c) => c.charCodeAt(0) < 32))
    return placeholder;
  if (/^\/(?!\/)/.test(source)) return source;
  if (/^data:image\/(png|jpeg|webp|gif|avif);base64,[a-z\d+/]+=*$/i.test(source)) return source;
  try {
    const url = new URL(source);
    return ["https:", "http:", "blob:"].includes(url.protocol) && !url.username && !url.password
      ? source
      : placeholder;
  } catch {
    return placeholder;
  }
}

function LoadableImage({
  src,
  srcSet,
  onError,
  style,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  const source = failed ? placeholder : src;
  const fallback = source === placeholder;
  return (
    <img
      {...props}
      ref={(image) => {
        if (!fallback && image?.complete && image.naturalWidth === 0) setFailed(true);
      }}
      src={source}
      srcSet={fallback ? undefined : srcSet}
      style={fallback ? { ...style, objectFit: "contain", backgroundColor: "#f3f7f4" } : style}
      data-product-image={fallback ? "placeholder" : "original"}
      onError={(event) => {
        if (fallback) return;
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}

export function ProductImage({ src, ...props }: ProductImageProps) {
  const source = imageSource(src);
  return <LoadableImage key={source} {...props} src={source} />;
}
