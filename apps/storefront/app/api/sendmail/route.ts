import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sendContactMessage } from "@plaspool/web/mail";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { name, email, phone, subject, message } = data ?? {};

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

    await sendContactMessage({ name, email, phone, subject, message }, apiKey);
    return NextResponse.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Contact form failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to send email" },
      { status: 500 },
    );
  }
}
