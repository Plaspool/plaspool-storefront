import { expect, it } from "vitest";
import { GET } from "./route";

/**
 * Under Vitest there is no Worker, so `getCloudflareContext()` throws and the
 * route is down to the header — which is exactly the `next dev` condition and
 * the one this file can honestly exercise.
 */

it("answers the country from the CF-IPCountry header when there is no Worker", async () => {
  const res = GET(new Request("http://localhost/api/geo", { headers: { "cf-ipcountry": "NG" } }));
  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({
    country: "NG",
    region: null,
    regionCode: null,
    city: null,
  });
});

it("answers an empty hint, not an error, with nothing to go on", async () => {
  const res = GET(new Request("http://localhost/api/geo"));
  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({
    country: null,
    region: null,
    regionCode: null,
    city: null,
  });
});

it("is about this caller and says so to every cache", () => {
  const res = GET(new Request("http://localhost/api/geo"));
  expect(res.headers.get("cache-control")).toBe("private, no-store");
});
