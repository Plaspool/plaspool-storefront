import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sendContactMessage, type ContactMessage } from "@plaspool/web/mail";

export async function POST(request: NextRequest) {
  /*
   * The parse gets its own catch, and deliberately says nothing about what it
   * caught. When a body is not JSON from its first byte, the SyntaxError quotes
   * the opening characters straight back — `Unexpected token 'm', "my private
   * note" is not valid JSON` — so logging it would put a fragment of the
   * submission into the Worker logs, undoing the line below. A truncated body
   * yields only a position and leaks nothing, but the two are indistinguishable
   * before parsing, so neither is logged.
   */
  let data: Partial<ContactMessage>;
  try {
    data = (await request.json()) ?? {};
  } catch {
    return NextResponse.json(
      { success: false, message: "Malformed request body" },
      { status: 400 },
    );
  }

  const { name, email, phone, subject, message } = data;

  // The previous implementation logged the whole submission on every request,
  // putting names, emails and phone numbers into log storage. That is gone.
  if (!name || !email || !subject || !message) {
    return NextResponse.json(
      { success: false, message: "Missing required fields" },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set");
    return NextResponse.json(
      { success: false, message: "Mail is not configured" },
      { status: 500 },
    );
  }

  try {
    await sendContactMessage({ name, email, phone, subject, message }, apiKey);
    return NextResponse.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    // Narrowed to the send: mail.ts throws only `Resend responded <status>`, so
    // this carries a status code and never the submission.
    console.error("Contact form failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to send email" },
      { status: 500 },
    );
  }
}
