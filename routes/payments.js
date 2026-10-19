import express from 'express';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import CollabRequest from '../models/CollabRequest.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { getStripe } from '../lib/stripeClient.js';

const router = express.Router();

const PLATFORM_FEE_PERCENT = 10;
const MIN_CENTS = 2500;       // $25
const MAX_CENTS = 1000000;    // $10,000 while we are small

const baseUrl = () => String(process.env.BASE_URL || '').replace(/\/+$/, '');
const isId = (v) => mongoose.Types.ObjectId.isValid(String(v));

// Split in whole cents. The collaborator gets 90%, QuikSpark keeps the rest, so
// the two always add up to exactly what the payer was charged.
export function splitAmount(amountCents) {
  const payoutCents = Math.floor((amountCents * (100 - PLATFORM_FEE_PERCENT)) / 100);
  return { payoutCents, platformFeeCents: amountCents - payoutCents };
}

function toDollars(cents) {
  return (cents / 100).toFixed(2);
}

function notConfigured(res) {
  return res.status(503).json({ success: false, message: 'Payments are not configured yet' });
}

// The logged-in user must be one of the two people on an accepted collaboration.
async function loadAcceptedThread(collabRequestId, userId) {
  if (!isId(collabRequestId)) return { error: [400, 'Invalid collaboration id'] };
  const collab = await CollabRequest.findById(collabRequestId);
  if (!collab) return { error: [404, 'Collaboration not found'] };
  const from = String(collab.fromUser);
  const to = String(collab.toUser);
  if (userId !== from && userId !== to) return { error: [403, 'Not part of this collaboration'] };
  if (collab.status !== 'accepted') return { error: [403, 'Payments open once the collaboration is accepted'] };
  return { collab, payeeId: userId === from ? to : from };
}

// What the browser is allowed to know about a payment
function publicPayment(payment, userId) {
  const isPayer = String(payment.payer) === userId;
  return {
    id: payment._id,
    role: isPayer ? 'payer' : 'payee',
    status: payment.status,
    amountCents: payment.amountCents,
    payoutCents: payment.payoutCents,
    platformFeeCents: payment.platformFeeCents,
    canRelease: isPayer && payment.status === 'held',
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
    releasedAt: payment.releasedAt
  };
}

// Has this person finished Stripe onboarding? Trust Stripe over our saved flag.
async function payeeIsReady(stripe, payee) {
  if (!payee.stripeAccountId) return false;
  if (payee.stripeOnboardingComplete) return true;
  const account = await stripe.accounts.retrieve(payee.stripeAccountId);
  const ready = !!(account.details_submitted && account.payouts_enabled);
  if (ready) {
    payee.stripeOnboardingComplete = true;
    await payee.save({ validateModifiedOnly: true });
  }
  return ready;
}

// POST /api/payments/fund  { collabRequestId, amount }   (amount in dollars)
// The logged-in user is the payer. Returns a Stripe Checkout URL to send them to.
router.post('/fund', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return notConfigured(res);

    const { collabRequestId, amount } = req.body || {};
    const userId = req.auth.userId;

    const dollars = Number(amount);
    const amountCents = Math.round(dollars * 100);
    if (!Number.isFinite(dollars) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
      return res.status(400).json({
        success: false,
        message: `Enter an amount between $${toDollars(MIN_CENTS)} and $${(MAX_CENTS / 100).toLocaleString('en-US')}`
      });
    }

    const { error, collab, payeeId } = await loadAcceptedThread(collabRequestId, userId);
    if (error) return res.status(error[0]).json({ success: false, message: error[1] });

    const [payer, payee] = await Promise.all([User.findById(userId), User.findById(payeeId)]);
    if (!payer || !payee) return res.status(404).json({ success: false, message: 'User not found' });

    if (!(await payeeIsReady(stripe, payee))) {
      return res.status(409).json({
        success: false,
        code: 'PAYEE_NOT_READY',
        message: `${payee.fullName} has not finished setting up payouts yet. Ask them to set up payouts first.`
      });
    }

    const { payoutCents, platformFeeCents } = splitAmount(amountCents);
    const payment = await Payment.create({
      collabRequest: collab._id,
      payer: payer._id,
      payee: payee._id,
      amountCents,
      payoutCents,
      platformFeeCents
    });

    const id = String(payment._id);
    const threadUrl = `${baseUrl()}/thread.html?id=${collab._id}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: { name: `Project funding for ${payee.fullName}` }
        }
      }],
      // Charged to QuikSpark's own balance. Nothing reaches the collaborator
      // until the payer clicks Release.
      payment_intent_data: { transfer_group: `payment_${id}`, metadata: { paymentId: id } },
      metadata: { paymentId: id },
      ...(payer.email ? { customer_email: payer.email } : {}),
      success_url: `${threadUrl}&payment=success`,
      cancel_url: `${threadUrl}&payment=canceled`
    }, { idempotencyKey: `fund_${id}` });

    payment.stripeCheckoutSessionId = session.id;
    await payment.save();

    res.json({ success: true, url: session.url, paymentId: payment._id });
  } catch (err) {
    console.error('Fund payment error:', err.message);
    res.status(500).json({ success: false, message: 'Could not start the payment. Please try again.' });
  }
});

// GET /api/payments/thread/:collabRequestId
router.get('/thread/:collabRequestId', requireAuth, async (req, res) => {
  try {
    const { error } = await loadAcceptedThread(req.params.collabRequestId, req.auth.userId);
    if (error) return res.status(error[0]).json({ success: false, message: error[1] });

    // Hide checkouts that were never completed
    const payments = await Payment.find({
      collabRequest: req.params.collabRequestId,
      status: { $in: ['held', 'released', 'refunded', 'failed'] }
    }).sort({ createdAt: -1 });

    res.json({ success: true, payments: payments.map((p) => publicPayment(p, req.auth.userId)) });
  } catch (err) {
    console.error('List payments error:', err.message);
    res.status(500).json({ success: false, message: 'Could not load payments' });
  }
});

// POST /api/payments/:id/release
// Only the person who paid can release, and only once the money is held.
router.post('/:id/release', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return notConfigured(res);
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid payment id' });

    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (String(payment.payer) !== req.auth.userId) {
      return res.status(403).json({ success: false, message: 'Only the person who paid can release this payment' });
    }
    if (payment.status === 'released') {
      return res.json({ success: true, payment: publicPayment(payment, req.auth.userId), alreadyReleased: true });
    }
    if (payment.status !== 'held') {
      return res.status(409).json({ success: false, message: 'This payment is not ready to release' });
    }

    const payee = await User.findById(payment.payee);
    if (!payee || !payee.stripeAccountId) {
      return res.status(409).json({ success: false, message: 'The collaborator has not set up payouts' });
    }

    // Tie the transfer to the original charge so it can be sent as soon as the
    // charge succeeds, even before the funds have settled.
    let chargeId = payment.stripeChargeId;
    if (!chargeId) {
      const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
      chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
      if (!chargeId) return res.status(409).json({ success: false, message: 'The charge for this payment is not available yet' });
    }

    // Same idempotency key every time: a double click or a retry after a crash can
    // never send the money twice.
    const transfer = await stripe.transfers.create({
      amount: payment.payoutCents,
      currency: payment.currency,
      destination: payee.stripeAccountId,
      source_transaction: chargeId,
      transfer_group: `payment_${payment._id}`,
      metadata: { paymentId: String(payment._id) }
    }, { idempotencyKey: `release_${payment._id}` });

    const updated = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'held' },
      { status: 'released', stripeChargeId: chargeId, stripeTransferId: transfer.id, releasedAt: new Date() },
      { new: true }
    );

    res.json({ success: true, payment: publicPayment(updated || payment, req.auth.userId) });
  } catch (err) {
    console.error('Release payment error:', err.message);
    res.status(500).json({ success: false, message: 'Could not release the payment. Nothing was sent. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Stripe webhook. Mounted in Server.js BEFORE express.json() because Stripe's
// signature check needs the exact raw bytes of the request.
// ─────────────────────────────────────────────────────────────
async function markHeld(stripe, session) {
  const paymentId = session.metadata?.paymentId;
  const payment = isId(paymentId)
    ? await Payment.findById(paymentId)
    : await Payment.findOne({ stripeCheckoutSessionId: session.id });
  if (!payment) {
    console.warn('Stripe webhook: no payment found for session', session.id);
    return;
  }
  if (payment.status !== 'pending') return; // already handled; Stripe retries are normal

  if (session.amount_total !== payment.amountCents) {
    payment.status = 'failed';
    payment.note = `Amount mismatch: expected ${payment.amountCents}, Stripe charged ${session.amount_total}`;
    await payment.save();
    console.error('Stripe webhook:', payment.note, 'payment', String(payment._id));
    return;
  }

  const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  let chargeId = null;
  try {
    const intent = await stripe.paymentIntents.retrieve(intentId);
    chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id || null;
  } catch (err) {
    console.warn('Stripe webhook: could not read charge yet, will look it up at release:', err.message);
  }

  await Payment.updateOne(
    { _id: payment._id, status: 'pending' },
    { status: 'held', stripePaymentIntentId: intentId, stripeChargeId: chargeId, paidAt: new Date() }
  );
}

export async function webhookHandler(req, res) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(503).send('Webhook not configured');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
  } catch (err) {
    console.warn('Stripe webhook signature check failed:', err.message);
    return res.status(400).send('Invalid signature');
  }

  try {
    const object = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
        if (object.payment_status === 'paid') await markHeld(stripe, object);
        break;
      case 'checkout.session.async_payment_succeeded':
        await markHeld(stripe, object);
        break;
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await Payment.updateOne(
          { stripeCheckoutSessionId: object.id, status: 'pending' },
          { status: 'canceled' }
        );
        break;
      case 'charge.refunded': {
        const payment = await Payment.findOne({ stripeChargeId: object.id });
        if (payment && object.refunded) {
          if (payment.status === 'held') {
            payment.status = 'refunded';
            await payment.save();
          } else if (payment.status === 'released') {
            // Money already left for the collaborator: a person has to sort this out
            console.error('Refund on a RELEASED payment, reverse the transfer in Stripe:', String(payment._id));
          }
        }
        break;
      }
      default:
        break; // events we do not use
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook processing error:', err.message);
    res.status(500).send('Processing error'); // Stripe will retry
  }
}

export default router;
