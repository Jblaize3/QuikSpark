import express from 'express';
import Stripe from 'stripe';
import User from '../models/User.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

router.post('/connect/onboard', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let accountId = user.stripeAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        }
      });
      accountId = account.id;
      user.stripeAccountId = accountId;
      await user.save();
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.BASE_URL}/stripe/connect/refresh`,
      return_url: `${process.env.BASE_URL}/stripe/connect/return`,
      type: 'account_onboarding'
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('Stripe onboarding error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/connect/return', (req, res) => {
  res.redirect('/profile-setup.html?stripe=complete');
});

router.get('/connect/refresh', (req, res) => {
  res.redirect('/profile-setup.html?stripe=retry');
});

export default router;
