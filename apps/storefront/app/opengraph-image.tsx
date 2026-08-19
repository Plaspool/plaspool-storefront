import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "PlaSpool — Buy 3D Printing Filament in Nigeria";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Generated at BUILD time. This route has no dynamic segment, so Next renders
 * it statically and `next/og`'s WASM never ships to the Cloudflare Worker.
 * Reading the logo with node:fs is safe for the same reason — do not turn this
 * into a dynamic route.
 */
export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/brand/logo-dark.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: 80,
          backgroundColor: "#231c50",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={520} />
        <div style={{ marginTop: 48, fontSize: 52, color: "#ffffff", lineHeight: 1.2 }}>
          Buy 3D printing filament in Nigeria
        </div>
        <div style={{ marginTop: 20, fontSize: 30, color: "#b8b2d6" }}>
          Tolerance-tested PLA · Nationwide delivery · By the spool or by the box
        </div>
      </div>
    ),
    size,
  );
}
