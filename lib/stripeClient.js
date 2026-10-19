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
