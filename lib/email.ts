import { Resend } from "resend";

/**
 * Resend email client. Server-only.
 */

let client: Resend | null = null;

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable");
  }
  if (!client) {
    client = new Resend(apiKey);
  }
  return client;
}

/** Display name shown as the email sender. */
const FROM_NAME = "WSS SEO Manager";

function resolveFrom(): string {
  const address = process.env.RESEND_FROM_EMAIL;
  if (!address) {
    throw new Error("Missing RESEND_FROM_EMAIL environment variable");
  }
  // If a display name is already provided (e.g. "Name <a@b.com>"), use as-is.
  return address.includes("<") ? address : `${FROM_NAME} <${address}>`;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string[];
  subject: string;
  html: string;
}): Promise<void> {
  const { error } = await getClient().emails.send({
    from: resolveFrom(),
    to,
    subject,
    html,
  });
  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
}
