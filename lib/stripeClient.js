import Stripe from 'stripe';

// Created on first use so a missing key returns a clear error from the route
// instead of stopping the whole server from starting.
let client = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

// Lets tests supply a fake client. Not used by the app itself.
export function setStripeClient(fake) {
  client = fake;
}

// ── Connected accounts (Stripe Accounts v2) ─────────────────────────────────
// Collaborators are "recipients": they receive transfers from QuikSpark's balance.
// QuikSpark collects fees and carries losses, and the user gets the Express dashboard.

export async function createRecipientAccount(stripe, { email } = {}) {
  const account = await stripe.v2.core.accounts.create({
    ...(email ? { contact_email: email } : {}),
    identity: { country: 'US' },
    dashboard: 'express',
    defaults: {
      responsibilities: { fees_collector: 'application', losses_collector: 'application' }
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
            payouts: { requested: true }
          }
        }
      }
    }
  });
  return account.id;
}

export async function createOnboardingLinkUrl(stripe, accountId, baseUrl) {
  const link = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        configurations: ['recipient'],
        refresh_url: `${baseUrl}/api/stripe/connect/refresh`,
        return_url: `${baseUrl}/api/stripe/connect/return`
      }
    }
  });
  return link.url;
}

// True once Stripe says this account can receive transfers from us.
export async function isRecipientReady(stripe, accountId) {
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ['configuration.recipient']
  });
  return account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === 'active';
}
