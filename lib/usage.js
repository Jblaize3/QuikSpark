import mongoose from 'mongoose';

// Counts how often something happened inside a window, for example AI match
// analyses per user per day. This is the first piece of the free-tier limits:
// the key names the thing and the window ("match:user:<id>:2026-10-30").
const usageSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

const Usage = mongoose.models.Usage || mongoose.model('Usage', usageSchema);

export const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

async function increment(key, by) {
  const options = { upsert: true, returnDocument: 'after' };
  const update = { $inc: { count: by }, $set: { updatedAt: new Date() } };
  try {
    return await Usage.findOneAndUpdate({ key }, update, options);
  } catch (err) {
    // Two first-ever requests can race on the unique key; the second one retries.
    if (err && err.code === 11000) return Usage.findOneAndUpdate({ key }, update, options);
    throw err;
  }
}

// Uses one unit if there is room. Never lets the stored count go past the limit.
export async function consumeUsage(key, limit) {
  const doc = await increment(key, 1);
  if (doc.count > limit) {
    await increment(key, -1);
    return { ok: false, count: limit, limit };
  }
  return { ok: true, count: doc.count, limit };
}

// Gives a unit back, for example when the AI call failed and the user got nothing.
export async function refundUsage(key) {
  await Usage.updateOne({ key, count: { $gt: 0 } }, { $inc: { count: -1 } });
}

export function envInt(name, fallback) {
  const n = Number.parseInt(process.env[name], 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
