import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const VALID = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "08030000000",
  subject: "general",
  message: "Do you ship to Abuja?",
};

function post(body: string) {
  return new NextRequest("http://localhost/api/sendmail", { method: "POST", body });
}

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/*
 * The one this file exists for. When a body is not JSON from its first byte,
 * V8's SyntaxError quotes the opening characters straight back —
 * `Unexpected token 'm', "my private note" is not valid JSON` — and a short
 * body is quoted whole. Letting that reach the shared catch would put a
 * fragment of the visitor's submission into the Worker logs, which is the exact
 * thing the comment above the field check says was removed.
 */
it("refuses a non-JSON body without logging — the SyntaxError quotes it straight back", async () => {
  const res = await POST(post("my private note"));

  expect(res.status).toBe(400);
  expect(console.error).not.toHaveBeenCalled();
});

/*
 * A body that starts as valid JSON and is merely truncated yields a
 * position-only message (`Expected ',' or '}' ... at position 48`) and leaks
 * nothing. The route cannot tell the two apart before parsing, so neither is
 * logged — this pins the same contract for the harmless shape.
 */
it("refuses a truncated JSON body without logging either", async () => {
  const res = await POST(post('{"name":"Ada Lovelace","email":'));

  expect(res.status).toBe(400);
  expect(console.error).not.toHaveBeenCalled();
});

it("passes a valid submission on to Resend", async () => {
  const res = await POST(post(JSON.stringify(VALID)));

  expect(res.status).toBe(200);
  expect(fetch).toHaveBeenCalledOnce();
});

it("still refuses a well-formed body that is missing required fields", async () => {
  const res = await POST(post(JSON.stringify({ name: "Ada Lovelace" })));

  expect(res.status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});

it("does not log the submission on a Resend failure either", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 422 })));

  const res = await POST(post(JSON.stringify(VALID)));

  expect(res.status).toBe(500);
  // It logs — that is the point of the catch — but mail.ts throws only
  // `Resend responded 422`, so the message carries a status code and nothing else.
  expect(console.error).toHaveBeenCalledWith(
    "Contact form failed:",
    expect.objectContaining({ message: "Resend responded 422" }),
  );
});
