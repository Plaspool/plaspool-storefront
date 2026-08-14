import Image from "next/image";
import { cn } from "@plaspool/ui";

const ART = {
  lockup: { light: "/brand/logo-light.png", dark: "/brand/logo-dark.png" },
  mark: { light: "/brand/logomark-light.png", dark: "/brand/logomark-dark.png" },
} as const;

// Intrinsic pixel dimensions of the source artwork (verified against the
// actual PNGs — do not guess these, a wrong ratio distorts the render).
const SIZE = {
  lockup: { width: 4800, height: 980 },
  mark: { width: 1080, height: 1080 },
} as const;

export function BrandLogo({
  variant = "lockup",
  tone = "light",
  className,
}: {
  variant?: "lockup" | "mark";
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <Image
      src={ART[variant][tone]}
      alt="PlaSpool"
      width={SIZE[variant].width}
      height={SIZE[variant].height}
      priority
      className={cn("w-auto", className)}
    />
  );
}
