import express from 'express';
import Stripe from 'stripe';
import User from '../models/User.js';
import { requireAuth, requireAuthPage } from '../middleware/auth.js';

const router = express.Router();

// Created on first use so a missing key returns a clear error instead of stopping
// the whole server from starting.
let stripeClient = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

const baseUrl = () => String(process.env.BASE_URL || '').replace(/\/+$/, '');

function notConfigured(res) {
  return res.status(503).json({ success: false, message: 'Payments are not configured yet' });
}

// Make sure the logged-in user has a Stripe Connect account, and return a fresh
// hosted onboarding link for it.
async function createOnboardingLink(stripe, user) {
  let accountId = user.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      ...(user.email ? { email: user.email } : {}),
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      }
    });
    accountId = account.id;
    user.stripeAccountId = accountId;
    await user.save({ validateModifiedOnly: true });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl()}/api/stripe/connect/refresh`,
    return_url: `${baseUrl()}/api/stripe/connect/return`,
    type: 'account_onboarding'
  });
  return link.url;
}

// POST /api/stripe/connect/onboard
// Starts (or resumes) Stripe onboarding for the logged-in user. The user comes from
// the session, never from the request body.
router.post('/connect/onboard', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return notConfigured(res);

    const user = await User.findById(req.auth.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, url: await createOnboardingLink(stripe, user) });
  } catch (err) {
    console.error('Stripe onboarding error:', err.message);
    res.status(500).json({ success: false, message: 'Could not start payout setup. Please try again.' });
  }
});

// GET /api/stripe/connect/return
// Stripe sends the user here when they finish or leave onboarding. We ask Stripe
// whether the account is actually ready rather than assuming.
router.get('/connect/return', requireAuthPage, async (req, res) => {
  try {
    const stripe = getStripe();
    const user = await User.findById(req.auth.userId);
    if (!stripe || !user || !user.stripeAccountId) return res.redirect('/myspark.html');

    const account = await stripe.accounts.retrieve(user.stripeAccountId);
    const complete = !!(account.details_submitted && account.payouts_enabled);
    if (complete !== !!user.stripeOnboardingComplete) {
      user.stripeOnboardingComplete = complete;
      await user.save({ validateModifiedOnly: true });
    }
    res.redirect(`/myspark.html?stripe=${complete ? 'complete' : 'pending'}`);
  } catch (err) {
    console.error('Stripe return error:', err.message);
    res.redirect('/myspark.html?stripe=error');
  }
});

// GET /api/stripe/connect/refresh
// The onboarding link expired or was opened twice. Issue a new one.
router.get('/connect/refresh', requireAuthPage, async (req, res) => {
  try {
    const stripe = getStripe();
    const user = await User.findById(req.auth.userId);
    if (!stripe || !user) return res.redirect('/myspark.html?stripe=error');
    res.redirect(await createOnboardingLink(stripe, user));
  } catch (err) {
    console.error('Stripe refresh error:', err.message);
    res.redirect('/myspark.html?stripe=error');
  }
});

// GET /api/stripe/connect/status
router.get('/connect/status', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({
      success: true,
      hasAccount: !!user.stripeAccountId,
      onboardingComplete: !!user.stripeOnboardingComplete
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load payout status' });
  }
});

export default router;
