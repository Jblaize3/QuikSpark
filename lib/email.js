// Sends transactional email through Resend's HTTP API (no extra dependency).
//
// Environment:
//   RESEND_API_KEY  required to actually send. Without it, emails are skipped and
//                   a one-line note is logged, so the site still works in dev.
//   EMAIL_FROM      "QuikSpark <hello@quik-spark.com>" by default. The domain must be
//                   verified in Resend (SPF and DKIM records) or mail lands in spam.
//   SUPPORT_EMAIL   optional reply-to address.
//   EMAIL_API_URL   optional override of the API address (used by tests).
//
// Sending never throws: a mail problem must not break signup, messaging or payments.

let override = null;

// Tests swap in a fake sender: async ({ to, subject, text, html }) => ({ ok: true })
export function setEmailSender(fn) {
  override = fn;
}

export const baseUrl = () =>
  String(process.env.BASE_URL || 'https://quik-spark.com').trim().replace(/\/+$/, '');

export async function sendEmail({ to, subject, text, html }) {
  if (!to) return { ok: false, skipped: true };
  try {
    if (override) return await override({ to, subject, text, html });

    const key = String(process.env.RESEND_API_KEY || '').trim();
    if (!key) {
      console.log(`[email] not sent (RESEND_API_KEY is not set): to=${to} subject="${subject}"`);
      return { ok: false, skipped: true };
    }

    const payload = {
      from: process.env.EMAIL_FROM || 'QuikSpark <hello@quik-spark.com>',
      to: [to],
      subject,
      text,
      html
    };
    if (process.env.SUPPORT_EMAIL) payload.reply_to = process.env.SUPPORT_EMAIL;

    const res = await fetch(process.env.EMAIL_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      console.error(`[email] provider rejected the message (${res.status}): ${detail}`);
      return { ok: false, status: res.status };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, id: data.id || null };
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return { ok: false };
  }
}

// For request handlers: start the send and move on, never wait or fail.
export function sendEmailInBackground(message) {
  sendEmail(message).catch(() => {});
}
