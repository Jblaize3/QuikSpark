import User from '../models/User.js';
import { sendEmailInBackground, baseUrl } from './email.js';
import { verifyEmail } from './emailTemplates.js';
import { newToken } from './tokens.js';

export const VERIFY_HOURS = 24;

// Stores a fresh confirmation token for the user and emails the link. Any earlier
// link stops working. Never throws.
export async function sendVerification(user) {
  try {
    if (!user?.email) return;
    const { token, hash } = newToken();
    await User.updateOne(
      { _id: user._id },
      { emailVerifyTokenHash: hash, emailVerifyExpires: new Date(Date.now() + VERIFY_HOURS * 60 * 60 * 1000) }
    );
    sendEmailInBackground({
      to: user.email,
      ...verifyEmail({
        toName: user.fullName,
        verifyUrl: `${baseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`
      })
    });
  } catch (err) {
    console.error('[email] could not start email confirmation:', err.message);
  }
}
