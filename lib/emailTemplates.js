// Email copy and layout. Copy rules for QuikSpark: "we" and "our" voice, no em
// dashes, no Oxford commas, plain language.
import { baseUrl } from './email.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const clip = (value, max) => {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 3).trimEnd() + '...' : s;
};

export const money = (cents) =>
  '$' + (Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

// One simple layout for every message: greeting, a few paragraphs, one button.
function layout({ preheader, greeting, paragraphs, quote, button, footnote }) {
  const url = button?.url;
  const textParts = [greeting, '', ...paragraphs];
  if (quote) textParts.push('', `"${quote}"`);
  if (button) textParts.push('', `${button.label}: ${url}`);
  if (footnote) textParts.push('', footnote);
  textParts.push('', 'The QuikSpark team', baseUrl());

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f3f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a24;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f0;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;">
<tr><td style="font-size:20px;font-weight:800;color:#5820F7;padding-bottom:20px;">QuikSpark</td></tr>
<tr><td style="font-size:16px;line-height:1.55;">
<p style="margin:0 0 16px;">${esc(greeting)}</p>
${paragraphs.map((p) => `<p style="margin:0 0 16px;">${esc(p)}</p>`).join('\n')}
${quote ? `<blockquote style="margin:0 0 20px;padding:12px 16px;background:#f4f3f0;border-left:3px solid #5820F7;border-radius:6px;color:#3a3a48;">${esc(quote)}</blockquote>` : ''}
${button ? `<p style="margin:24px 0;"><a href="${esc(url)}" style="background:#5820F7;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:100px;display:inline-block;">${esc(button.label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#6b6b78;">Button not working? Copy this link into your browser:<br><span style="word-break:break-all;">${esc(url)}</span></p>` : ''}
${footnote ? `<p style="margin:0 0 16px;font-size:14px;color:#6b6b78;">${esc(footnote)}</p>` : ''}
</td></tr>
<tr><td style="padding-top:20px;border-top:1px solid #ececf0;font-size:12px;color:#8a8a96;">You are getting this email because you have a QuikSpark account. Reply to this email if you need a hand.</td></tr>
</table></td></tr></table></body></html>`;

  return { text: textParts.join('\n'), html };
}

export function requestReceived({ toName, fromName, message, requestsUrl }) {
  const subject = `${fromName} sent you a collaboration request`;
  return {
    subject,
    ...layout({
      preheader: clip(message, 90),
      greeting: `Hi ${firstName(toName)},`,
      paragraphs: [`${fromName} wants to collaborate with you on QuikSpark. Here is what they wrote:`],
      quote: clip(message, 300),
      button: { label: 'View the request', url: requestsUrl },
      footnote: 'You can accept or decline from My Spark. Nobody can message you until you accept.'
    })
  };
}

export function requestAccepted({ toName, accepterName, threadUrl }) {
  return {
    subject: `${accepterName} accepted your request`,
    ...layout({
      preheader: 'Your conversation is open.',
      greeting: `Hi ${firstName(toName)},`,
      paragraphs: [`${accepterName} accepted your collaboration request. Your conversation is open, so you can message each other now.`],
      button: { label: 'Open the conversation', url: threadUrl }
    })
  };
}

export function newMessage({ toName, fromName, body, threadUrl }) {
  return {
    subject: `New message from ${fromName}`,
    ...layout({
      preheader: clip(body, 90),
      greeting: `Hi ${firstName(toName)},`,
      paragraphs: [`${fromName} sent you a message:`],
      quote: clip(body, 240),
      button: { label: 'Reply on QuikSpark', url: threadUrl },
      footnote: 'To keep your inbox clear, we only email you about the first unread message in a conversation.'
    })
  };
}

export function paymentHeldForPayee({ toName, payerName, amountCents, payoutCents, feeCents, needsPayoutSetup, threadUrl, settingsUrl }) {
  const paragraphs = [
    `${payerName} funded your project with ${money(amountCents)}. We are holding it safely until they release it.`,
    `When they do, you receive ${money(payoutCents)} after our ${money(feeCents)} servicing fee.`
  ];
  if (needsPayoutSetup) {
    paragraphs.push('You have not set up payouts yet. Please do that on My Spark so we can send your money as soon as it is released.');
  }
  return {
    subject: `${payerName} funded your project`,
    ...layout({
      preheader: `${money(amountCents)} is being held for you.`,
      greeting: `Hi ${firstName(toName)},`,
      paragraphs,
      button: needsPayoutSetup ? { label: 'Set up payouts', url: settingsUrl } : { label: 'Open the conversation', url: threadUrl }
    })
  };
}

export function paymentHeldForPayer({ toName, payeeName, amountCents, threadUrl }) {
  return {
    subject: 'Your payment is held',
    ...layout({
      preheader: `${money(amountCents)} is held for ${payeeName}.`,
      greeting: `Hi ${firstName(toName)},`,
      paragraphs: [
        `We received your ${money(amountCents)} payment and we are holding it for ${payeeName}.`,
        'Nothing is sent until you press Release Payment on the conversation page. Release it when you are happy with the work.'
      ],
      button: { label: 'Open the conversation', url: threadUrl }
    })
  };
}

export function paymentReleased({ toName, payerName, payoutCents, threadUrl }) {
  return {
    subject: `${payerName} released your payment`,
    ...layout({
      preheader: `${money(payoutCents)} is on its way.`,
      greeting: `Hi ${firstName(toName)},`,
      paragraphs: [
        `${payerName} released your payment. We sent ${money(payoutCents)} to your payout account.`,
        'Your bank can take a few business days to show it.'
      ],
      button: { label: 'Open the conversation', url: threadUrl }
    })
  };
}

export function passwordReset({ toName, resetUrl }) {
  return {
    subject: 'Reset your QuikSpark password',
    ...layout({
      preheader: 'This link works for one hour.',
      greeting: `Hi ${firstName(toName)},`,
      paragraphs: ['We got a request to reset your QuikSpark password. This link works for one hour and only once.'],
      button: { label: 'Choose a new password', url: resetUrl },
      footnote: 'If you did not ask for this, you can ignore this email. Your password stays the same.'
    })
  };
}

export function verifyEmail({ toName, verifyUrl }) {
  return {
    subject: 'Confirm your email for QuikSpark',
    ...layout({
      preheader: 'One quick step to finish setting up.',
      greeting: `Hi ${firstName(toName)},`,
      paragraphs: ['Please confirm this is your email address so we can send you request, message and payment updates.'],
      button: { label: 'Confirm my email', url: verifyUrl },
      footnote: 'If you did not create a QuikSpark account, you can ignore this email.'
    })
  };
}
