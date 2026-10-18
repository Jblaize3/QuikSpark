import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { issueSession, clearSession, requireAuth, rateLimit } from '../middleware/auth.js';

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
        stripeOnboardingComplete: !!user.stripeOnboardingComplete
      }
    });
  } catch (error) {
    console.error('Auth me error:', error.message);
    res.status(500).json({ success: false, message: 'Could not load your account' });
  }
});

export default router;
