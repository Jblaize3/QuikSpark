// Activity emails: new request, accepted, new message, payment held and released.
// Every function swallows its own errors and returns a promise that never rejects,
// so routes can call them without awaiting and without a try/catch.
//
// Only people who confirmed their email address get these. That stops anyone from
// signing up with a stranger's address and using QuikSpark to send them mail.
import User from '../models/User.js';
import { sendEmailInBackground, baseUrl } from './email.js';
import * as templates from './emailTemplates.js';

export const canEmail = (user) => !!(user && user.email && user.emailVerified && user.isActive !== false);

const threadUrl = (collabRequestId) => `${baseUrl()}/thread.html?id=${collabRequestId}`;

function guard(label, fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`[notify] ${label} failed:`, err.message);
    }
  };
}

// request: { fromUser, toUser, message }
export const notifyRequestReceived = guard('request received', async (request) => {
  const [from, to] = await Promise.all([User.findById(request.fromUser), User.findById(request.toUser)]);
  if (!from || !canEmail(to)) return;
  sendEmailInBackground({
    to: to.email,
    ...templates.requestReceived({
      toName: to.fullName,
      fromName: from.fullName,
      message: request.message,
      requestsUrl: `${baseUrl()}/myspark.html`
    })
  });
});

// request: the accepted CollabRequest. The sender hears that the receiver accepted.
export const notifyRequestAccepted = guard('request accepted', async (request) => {
  const [sender, accepter] = await Promise.all([User.findById(request.fromUser), User.findById(request.toUser)]);
  if (!accepter || !canEmail(sender)) return;
  sendEmailInBackground({
    to: sender.email,
    ...templates.requestAccepted({
      toName: sender.fullName,
      accepterName: accepter.fullName,
      threadUrl: threadUrl(request._id)
    })
  });
});

// collabRequest: the thread's request. Emails whoever did not write the message.
export const notifyNewMessage = guard('new message', async ({ collabRequest, senderId, body }) => {
  const recipientId = String(collabRequest.fromUser) === String(senderId) ? collabRequest.toUser : collabRequest.fromUser;
  const [sender, recipient] = await Promise.all([User.findById(senderId), User.findById(recipientId)]);
  if (!sender || !canEmail(recipient)) return;
  sendEmailInBackground({
    to: recipient.email,
    ...templates.newMessage({
      toName: recipient.fullName,
      fromName: sender.fullName,
      body,
      threadUrl: threadUrl(collabRequest._id)
    })
  });
});

export const notifyPaymentHeld = guard('payment held', async (payment) => {
  const [payer, payee] = await Promise.all([User.findById(payment.payer), User.findById(payment.payee)]);
  if (!payer || !payee) return;
  const url = threadUrl(payment.collabRequest);
  if (canEmail(payee)) {
    sendEmailInBackground({
      to: payee.email,
      ...templates.paymentHeldForPayee({
        toName: payee.fullName,
        payerName: payer.fullName,
        amountCents: payment.amountCents,
        payoutCents: payment.payoutCents,
        feeCents: payment.platformFeeCents,
        needsPayoutSetup: !payee.stripeOnboardingComplete,
        threadUrl: url,
        settingsUrl: `${baseUrl()}/myspark.html`
      })
    });
  }
  if (canEmail(payer)) {
    sendEmailInBackground({
      to: payer.email,
      ...templates.paymentHeldForPayer({
        toName: payer.fullName,
        payeeName: payee.fullName,
        amountCents: payment.amountCents,
        threadUrl: url
      })
    });
  }
});

export const notifyPaymentReleased = guard('payment released', async (payment) => {
  const [payer, payee] = await Promise.all([User.findById(payment.payer), User.findById(payment.payee)]);
  if (!payer || !canEmail(payee)) return;
  sendEmailInBackground({
    to: payee.email,
    ...templates.paymentReleased({
      toName: payee.fullName,
      payerName: payer.fullName,
      payoutCents: payment.payoutCents,
      threadUrl: threadUrl(payment.collabRequest)
    })
  });
});
