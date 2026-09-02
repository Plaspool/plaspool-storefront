import { afterEach, describe, expect, it } from "vitest";

import { INTRO_DISMISSED_KEY, introDismissed, setIntroDismissed } from "./intro-dismissed";

/**
 * The suite runs on `environment: "node"`, so there is no `localStorage` here
 * unless a test puts one there — which is exactly the SSR case the first test
 * below pins, and the reason these functions read `globalThis` rather than
 * `window`.
 */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

/** Safari in private mode: the property exists and every call throws. */
function hostileStorage(): Storage {
  const boom = () => {
    throw new DOMException("QuotaExceededError");
  };
  return {
    length: 0,
    clear: boom,
    getItem: boom,
    key: boom,
    removeItem: boom,
    setItem: boom,
  };
}

function withStorage(storage: Storage | undefined) {
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("the returns intro's dismissal flag", () => {
  it("reads as not-dismissed where there is no storage at all", () => {
    // The server render, and any browser that has disabled site data. The
    // intro showing once too often is recoverable; a crash in the modal's
    // render is not.
    expect(introDismissed()).toBe(false);
  });

  it("reads back what was written", () => {
    withStorage(fakeStorage());
    setIntroDismissed(true);
    expect(introDismissed()).toBe(true);
  });

  it("removes the key rather than storing a falsy value", () => {
    // Unchecking the box must leave no trace: a stored "false" is a value
    // some future reader could mistake for a deliberate opt-in.
    const storage = fakeStorage();
    withStorage(storage);
    setIntroDismissed(true);
    setIntroDismissed(false);
    expect(introDismissed()).toBe(false);
    expect(storage.getItem(INTRO_DISMISSED_KEY)).toBeNull();
  });

  it("answers false rather than throwing when every storage call throws", () => {
    // Safari private mode. `readShopSession()`'s own doctrine applies: a
    // storage that cannot be read is not a shopper who asked to skip this.
    withStorage(hostileStorage());
    expect(introDismissed()).toBe(false);
  });

  it("swallows a throwing write rather than taking the dialog down", () => {
    withStorage(hostileStorage());
    expect(() => setIntroDismissed(true)).not.toThrow();
  });
});
