"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Maximize2, ZoomIn } from "lucide-react";
import type { IconKey } from "@/lib/data";
import { cn } from "@/lib/utils";
import { ProductMedia } from "@/components/commerce/product-media";

export function ProductGallery({
  icon,
  tone,
  name,
  images = [],
  views,
}: {
  icon: IconKey;
  tone: string;
  name: string;
  images?: string[];
  views?: string[];
}) {
  const slides = useMemo(() => {
    const urls = images.filter(Boolean);
    if (urls.length) {
      return urls.map((src, index) => ({
        key: `${src}-${index}`,
        src,
        label: index === 0 ? "Main" : `View ${index + 1}`,
      }));
    }
    const labels = views ?? ["Front", "Side", "Ports", "In use"];
    return labels.map((label) => ({ key: label, src: undefined as string | undefined, label }));
  }, [images, views]);

  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const current = slides[Math.min(active, slides.length - 1)] ?? slides[0];

  return (
    <div className="flex flex-col gap-4 sm:flex-row-reverse">
      <div className="relative min-w-0 flex-1">
        {current?.src ? (
          <div
            className={cn(
              "relative aspect-square w-full overflow-hidden rounded-2xl bg-soft transition-transform duration-500 ease-premium",
              zoom && "scale-[1.35] cursor-zoom-out",
            )}
          >
            <Image
              src={current.src}
              alt={`${name} — ${current.label}`}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-6"
              priority
              placeholder="blur"
              blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjRjRGNkZBIi8+PC9zdmc+"
            />
          </div>
        ) : (
          <ProductMedia
            icon={icon}
            tone={tone}
            name={`${name} — ${current?.label ?? "view"}`}
            className={cn(
              "aspect-square w-full rounded-2xl transition-transform duration-500 ease-premium",
              zoom && "scale-[1.35] cursor-zoom-out",
            )}
            iconClassName="h-1/2 w-1/2"
          />
        )}
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <button
            type="button"
            aria-pressed={zoom}
            aria-label={zoom ? "Zoom out" : "Zoom in"}
            onClick={() => setZoom((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/90 text-ink backdrop-blur transition-colors hover:bg-white"
          >
            <ZoomIn className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Open full screen"
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/90 text-ink backdrop-blur transition-colors hover:bg-white"
          >
            <Maximize2 className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
        <p className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted backdrop-blur">
          {current?.label ?? "View"} · hover to zoom
        </p>
      </div>

      <div className="no-scrollbar flex gap-3 overflow-x-auto sm:flex-col sm:overflow-visible">
        {slides.map((slide, index) => (
          <button
            key={slide.key}
            type="button"
            aria-label={`Show ${slide.label} view`}
            aria-pressed={index === active}
            onClick={() => setActive(index)}
            className={cn(
              "relative shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200",
              index === active ? "border-primary" : "border-transparent hover:border-line",
            )}
          >
            {slide.src ? (
              <span className="relative block h-20 w-20 bg-soft">
                <Image
                  src={slide.src}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-contain p-2"
                />
              </span>
            ) : (
              <ProductMedia
                icon={icon}
                tone={tone}
                name={`${name} thumbnail ${slide.label}`}
                className="h-20 w-20"
                iconClassName="h-2/5 w-2/5"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
