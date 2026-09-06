import { describe, expect, it, vi } from "vitest";
import { EMPTY_HINT, detectGeoHint, readGeoHint } from "./geo-hint";

const headers = (entries: Record<string, string> = {}) => new Headers(entries);

describe("detecting the hint at the edge", () => {
  it("reads Cloudflare's own properties first", () => {
    expect(
      detectGeoHint(headers({ "cf-ipcountry": "GB" }), {
        country: "NG",
        region: "Lagos",
        regionCode: "la",
        city: "Lagos",
      }),
    ).toEqual({ country: "NG", region: "Lagos", regionCode: "LA", city: "Lagos" });
  });

  it("falls back to the header when there is no cf object", () => {
    expect(detectGeoHint(headers({ "cf-ipcountry": "ng" }))).toEqual({
      ...EMPTY_HINT,
      country: "NG",
    });
  });

  it("is empty under next dev, where neither exists", () => {
    expect(detectGeoHint(headers())).toEqual(EMPTY_HINT);
    expect(detectGeoHint(headers(), null)).toEqual(EMPTY_HINT);
  });

  it("refuses Cloudflare's placeholders for unknown and Tor", () => {
    expect(detectGeoHint(headers({ "cf-ipcountry": "XX" })).country).toBeNull();
    expect(detectGeoHint(headers(), { country: "T1" }).country).toBeNull();
  });

  it("refuses a value that is not a country at all", () => {
    expect(detectGeoHint(headers(), { country: 42, region: 7 })).toEqual(EMPTY_HINT);
    expect(detectGeoHint(headers({ "cf-ipcountry": "" })).country).toBeNull();
  });
});

describe("reading the hint in the browser", () => {
  const answering = (body: unknown, status = 200) =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it("hands back what the route said", async () => {
    const fetchImpl = answering({ country: "ng", region: "Lagos", regionCode: "LA", city: "Ikeja" });
    await expect(readGeoHint(fetchImpl)).resolves.toEqual({
      country: "NG",
      region: "Lagos",
      regionCode: "LA",
      city: "Ikeja",
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/geo", { cache: "no-store" });
  });

  it("is empty, never a rejection, when the route fails", async () => {
    await expect(readGeoHint(answering({}, 500))).resolves.toEqual(EMPTY_HINT);
    await expect(readGeoHint(vi.fn().mockRejectedValue(new Error("offline")))).resolves.toEqual(
      EMPTY_HINT,
    );
    await expect(readGeoHint(answering("not an object"))).resolves.toEqual(EMPTY_HINT);
  });

  it("does not trust a country the list does not know", async () => {
    await expect(readGeoHint(answering({ country: "XX" }))).resolves.toEqual(EMPTY_HINT);
  });
});
