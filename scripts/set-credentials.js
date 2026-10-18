// One-off: give an existing profile (one created before logins existed) an email
// and password so its owner can log in.
//
//   node scripts/set-credentials.js <userId> <email> <password>
//
// Reads MONGODB_URI from .env, same as the server.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

dotenv.config();

const [userId, emailArg, password] = process.argv.slice(2);

if (!userId || !emailArg || !password) {
  console.error('Usage: node scripts/set-credentials.js <userId> <email> <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();

try {
  await mongoose.connect(process.env.MONGODB_URI);

  const clash = await User.findOne({ email, _id: { $ne: userId } });
  if (clash) throw new Error(`Email ${email} is already used by another profile (${clash._id}).`);

  const user = await User.findById(userId);
  if (!user) throw new Error(`No profile found with id ${userId}.`);

  user.email = email;
  user.passwordHash = await bcrypt.hash(password, 12);
  await user.save({ validateModifiedOnly: true });

  console.log(`Done. ${user.fullName} can now log in with ${email}.`);
} catch (error) {
  console.error('Failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
