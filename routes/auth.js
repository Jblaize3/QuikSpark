import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { issueSession, clearSession, requireAuth, rateLimit } from '../middleware/auth.js';
import { sendEmailInBackground, baseUrl } from '../lib/email.js';
import { passwordReset } from '../lib/emailTemplates.js';
import { newToken, hashToken } from '../lib/tokens.js';
import { sendVerification } from '../lib/accountEmails.js';

const router = express.Router();

// Compared against when the email is unknown so response time does not reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase()}`,
  message: 'Too many login attempts. Please wait a few minutes and try again.'
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);

    if (!user || !user.passwordHash || !ok || user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Incorrect email or password' });
    }

    issueSession(res, user._id);
    res.json({
      success: true,
      user: { id: user._id, fullName: user.fullName, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_MINUTES = 60;
const FORGOT_REPLY = 'If an account exists for that email, we sent a link to reset your password.';

// Two limits: one per address (so nobody can flood a person's inbox) and one per
// network address (so nobody can sweep through many emails).
const forgotEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyFn: (req) => `forgot-email|${String(req.body?.email || '').trim().toLowerCase()}`,
  message: 'Too many reset requests for this email. Please wait an hour and try again.'
});
const forgotIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyFn: (req) => `forgot-ip|${req.ip}`,
  message: 'Too many reset requests. Please try again later.'
});
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `reset|${req.ip}`,
  message: 'Too many attempts. Please wait a few minutes and try again.'
});
const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyFn: (req) => `resend-verify|${req.auth?.userId || req.ip}`,
  message: 'We already sent you a few emails. Please check your inbox and spam folder, or try again in an hour.'
});

// POST /api/auth/forgot  { email }
// Always answers the same way, so this cannot be used to find out who has an account.
router.post('/forgot', forgotIpLimiter, forgotEmailLimiter, async (req, res) => {
  res.json({ success: true, message: FORGOT_REPLY });
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return;
    const user = await User.findOne({ email });
    if (!user || user.isActive === false) return;

    const { token, hash } = newToken();
    await User.updateOne(
      { _id: user._id },
      { passwordResetTokenHash: hash, passwordResetExpires: new Date(Date.now() + RESET_MINUTES * 60 * 1000) }
    );
    sendEmailInBackground({
      to: user.email,
      ...passwordReset({
        toName: user.fullName,
        resetUrl: `${baseUrl()}/reset-password.html?token=${encodeURIComponent(token)}`
      })
    });
  } catch (error) {
    console.error('Forgot password error:', error.message);
  }
});

// POST /api/auth/reset  { token, password }
router.post('/reset', resetLimiter, async (req, res) => {
  try {
    const token = String(req.body?.token || '');
    const password = req.body?.password;
    const invalid = { success: false, message: 'This reset link is invalid or has expired. Please ask for a new one.' };

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    if (password.length > 72) {
      return res.status(400).json({ success: false, message: 'Password must be 72 characters or fewer' });
    }
    if (!token) return res.status(400).json(invalid);

    const tokenHash = hashToken(token);
    const user = await User.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpires: { $gt: new Date() } });
    if (!user || user.isActive === false) return res.status(400).json(invalid);

    // The filter on the token hash makes the link work exactly once, even if two
    // requests arrive together. Following the emailed link also proves the inbox
    // is theirs, so the address counts as confirmed.
    const result = await User.updateOne(
      { _id: user._id, passwordResetTokenHash: tokenHash },
      {
        $set: { passwordHash: await bcrypt.hash(password, 12), emailVerified: true },
        $unset: { passwordResetTokenHash: '', passwordResetExpires: '' }
      }
    );
    if (result.modifiedCount !== 1) return res.status(400).json(invalid);

    issueSession(res, user._id);
    res.json({ success: true, user: { id: user._id, fullName: user.fullName, role: user.role } });
  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ success: false, message: 'Could not reset your password. Please try again.' });
  }
});

// GET /api/auth/verify-email?token=...  (the link in the confirmation email)
router.get('/verify-email', async (req, res) => {
  try {
    const token = String(req.query?.token || '');
    let ok = false;
    if (token) {
      const result = await User.updateOne(
        { emailVerifyTokenHash: hashToken(token), emailVerifyExpires: { $gt: new Date() } },
        { $set: { emailVerified: true }, $unset: { emailVerifyTokenHash: '', emailVerifyExpires: '' } }
      );
      ok = result.modifiedCount === 1;
    }
    res.redirect(`/myspark.html?verified=${ok ? '1' : '0'}`);
  } catch (error) {
    console.error('Verify email error:', error.message);
    res.redirect('/myspark.html?verified=0');
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', requireAuth, resendLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user || !user.email) return res.status(400).json({ success: false, message: 'There is no email on this account' });
    if (user.emailVerified) return res.json({ success: true, alreadyVerified: true });
    await sendVerification(user);
    res.json({ success: true });
  } catch (error) {
    console.error('Resend verification error:', error.message);
    res.status(500).json({ success: false, message: 'Could not send the email. Please try again.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user || user.isActive === false) {
      clearSession(res);
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Please log in to continue' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email || null,
        role: user.role,
        profileImage: user.profileImage,
        emailVerified: !!user.emailVerified,
        stripeOnboardingComplete: !!user.stripeOnboardingComplete
      }
    });
  } catch (error) {
    console.error('Auth me error:', error.message);
    res.status(500).json({ success: false, message: 'Could not load your account' });
  }
});

export default router;
