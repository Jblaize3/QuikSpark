import mongoose from 'mongoose';

// One row per funding of a collaboration. Money flow:
//   pending  -> payer has started checkout
//   held     -> payer paid; funds sit with QuikSpark
//   released -> payer approved; 90% transferred to the collaborator
//   canceled -> checkout expired or was abandoned
//   failed   -> something did not add up (amount mismatch); needs a human
//   refunded -> returned to the payer from the Stripe dashboard
const paymentSchema = new mongoose.Schema({
  collabRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'CollabRequest', required: true, index: true },
  payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  payee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // All money in integer cents
  amountCents: { type: Number, required: true, min: 1 },
  platformFeeCents: { type: Number, required: true, min: 0 },
  payoutCents: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'usd' },

  status: {
    type: String,
    enum: ['pending', 'held', 'released', 'canceled', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },

  stripeCheckoutSessionId: { type: String, index: true, sparse: true },
  stripePaymentIntentId: { type: String, default: null },
  stripeChargeId: { type: String, default: null },
  stripeTransferId: { type: String, default: null },

  note: { type: String, default: null },
  paidAt: { type: Date, default: null },
  releasedAt: { type: Date, default: null }
}, {
  timestamps: true
});

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
