import { describe, expect, it } from "vitest";
import { isRough, readingFrom } from "./location-reading";
import { parseDeliveryConfig } from "../data/delivery-config";

/**
 * Turning a browser fix into the thing the address carries.
 *
 * WHAT THESE ARE ABOUT. The reading is for the RIDER — it is never required,
 * it never prices anything, and a rough one is still worth keeping because a
 * 2km fix still narrows a rider's search. So the cases here are about not
 * throwing information away and not sending a shape the server will refuse.
 */

const position = (coords: { latitude: number; longitude: number; accuracy: number }, timestamp = 1_756_704_000_000) =>
  ({ coords, timestamp }) as GeolocationPosition;

const configWithMax = (maxAccuracyMeters: number | undefined) =>
  parseDeliveryConfig({
    config: {
      mode: "simple",
      revision: 1,
      fields: [{ key: "region", show: true, required: true, label: "State" }],
      location: { offer: true, required: false, maxAccuracyMeters, pricing: false },
    },
  });

describe("reading a browser fix", () => {
  it("carries the coordinates through as decimal degrees", () => {
    const reading = readingFrom(position({ latitude: 9.05785, longitude: 7.49508, accuracy: 32 }));
    expect(reading).toMatchObject({ lat: 9.05785, lng: 7.49508 });
  });

  it("rounds accuracy to a whole metre", () => {
    // The server stores an integer. Sending 32.40000000001 is a fractional
    // metre of precision nobody has and the column cannot hold.
    const reading = readingFrom(position({ latitude: 9.05, longitude: 7.49, accuracy: 32.4 }));
    expect(reading.accuracyM).toBe(32);
  });

  it("is a device reading, not a dropped pin", () => {
    expect(readingFrom(position({ latitude: 9.05, longitude: 7.49, accuracy: 5 })).source).toBe(
      "device",
    );
  });

  it("keeps the browser's own timestamp rather than stamping now", () => {
    // When the fix was taken is what matters to a rider, not when this code
    // happened to run — a cached fix can be minutes old.
    const reading = readingFrom(
      position({ latitude: 9.05, longitude: 7.49, accuracy: 5 }, 1_700_000_000_000),
    );
    expect(reading.capturedAt).toBe(1_700_000_000_000);
  });
});

describe("whether a reading is too rough to trust on its own", () => {
  it("is rough past the configured accuracy", () => {
    const reading = readingFrom(position({ latitude: 9.05, longitude: 7.49, accuracy: 2000 }));
    expect(isRough(reading, configWithMax(500))).toBe(true);
  });

  it("is not rough inside it", () => {
    const reading = readingFrom(position({ latitude: 9.05, longitude: 7.49, accuracy: 32 }));
    expect(isRough(reading, configWithMax(500))).toBe(false);
  });

  it("is never rough when the config sets no limit", () => {
    const reading = readingFrom(position({ latitude: 9.05, longitude: 7.49, accuracy: 50_000 }));
    expect(isRough(reading, configWithMax(undefined))).toBe(false);
  });
});
