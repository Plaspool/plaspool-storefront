/**
 * Resend over HTTP. Cloudflare Workers has no raw TCP, so SMTP — and therefore
 * nodemailer — is off the table. `RESEND_API_KEY` is the only secret this app
 * has, and it is passed in rather than read here so this module stays free of
 * environment assumptions.
 */
export interface ContactMessage {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

const FROM = "PlaSpool <noreply@plaspool.com>";
const TO = "hello@plaspool.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactMessage(
  data: ContactMessage,
  apiKey: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: data.email,
      subject: `Contact form: ${data.subject}`,
      text: [
        `Name: ${data.name}`,
        `Email: ${data.email}`,
        data.phone ? `Phone: ${data.phone}` : null,
        "",
        data.message,
      ]
        .filter(Boolean)
        .join("\n"),
      // The previous implementation interpolated form values straight into
      // HTML. A contact form is untrusted input reaching an inbox — escape it.
      html: [
        "<h3>New contact form submission</h3>",
        `<p><strong>Name:</strong> ${escapeHtml(data.name)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(data.email)}</p>`,
        data.phone ? `<p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>` : "",
        `<p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>`,
        `<p>${escapeHtml(data.message).replace(/\n/g, "<br>")}</p>`,
      ].join(""),
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}`);
  }
}
