import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PlaSpool — 3D Printing Filament",
    short_name: "PlaSpool",
    description: "Buy 3D printing filament in Nigeria.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#231c50",
    icons: [{ src: "/brand/icon.png", sizes: "1024x1024", type: "image/png" }],
  };
}
