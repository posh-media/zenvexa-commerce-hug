"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Armchair,
  Camera,
  Cpu,
  Gamepad2,
  HardDrive,
  Headphones,
  Keyboard,
  Laptop,
  Lightbulb,
  Monitor,
  Mouse,
  Plug,
  Printer,
  Router,
  Smartphone,
  Speaker,
  Tablet,
  Watch,
} from "lucide-react";
import type { IconKey } from "@/lib/data";
import { cn } from "@/lib/utils";

const map: Record<IconKey, React.ElementType> = {
  laptop: Laptop,
  monitor: Monitor,
  smartphone: Smartphone,
  tablet: Tablet,
  headphones: Headphones,
  speaker: Speaker,
  watch: Watch,
  gamepad: Gamepad2,
  keyboard: Keyboard,
  mouse: Mouse,
  camera: Camera,
  printer: Printer,
  router: Router,
  cpu: Cpu,
  harddrive: HardDrive,
  lightbulb: Lightbulb,
  chair: Armchair,
  plug: Plug,
};

export function ProductIcon({
  icon,
  className,
}: {
  icon: IconKey;
  className?: string;
}) {
  const Icon = map[icon] ?? Laptop;
  return <Icon className={className} aria-hidden />;
}

/**
 * Product imagery: prefers a real image URL, otherwise a tinted glyph fallback.
 */
export function ProductMedia({
  icon,
  tone,
  name,
  src,
  className,
  iconClassName,
  iconTone = "text-ink/75",
  sizes = "(max-width: 768px) 50vw, 25vw",
  priority = false,
}: {
  icon: IconKey;
  tone: string;
  name: string;
  src?: string;
  className?: string;
  iconClassName?: string;
  iconTone?: string;
  /** Override next/image sizes for layout-specific CLS control. */
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-xl",
        tone,
        className,
      )}
    >
      {showImage ? (
        <Image
          src={src!}
          alt={name}
          fill
          sizes={sizes}
          className="object-contain p-4 transition-transform duration-500 ease-premium"
          onError={() => setFailed(true)}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          placeholder="blur"
          blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjRjRGNkZBIi8+PC9zdmc+"
        />
      ) : (
        <>
          <span
            className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/60 blur-2xl"
            aria-hidden
          />
          <ProductIcon
            icon={icon}
            className={cn(
              "relative h-1/2 w-1/2 transition-transform duration-500 ease-premium",
              iconTone,
              iconClassName,
            )}
          />
        </>
      )}
    </div>
  );
}

export function BrandMark({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid h-12 w-12 place-items-center rounded-xl bg-soft text-sm font-semibold tracking-tight text-ink",
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
