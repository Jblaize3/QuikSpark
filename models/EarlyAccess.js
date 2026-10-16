import mongoose from 'mongoose';

const earlyAccessSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  interests: [{ type: String, trim: true }],

  // Mailchimp sync state. The signup is saved here first, so a Mailchimp
  // outage or billing lapse never loses a lead.
  mailchimpSynced: { type: Boolean, default: false },
  mailchimpSyncedAt: { type: Date, default: null },
  mailchimpLastError: { type: String, default: null },
  mailchimpAttempts: { type: Number, default: 0 }
}, {
  timestamps: true
});

earlyAccessSchema.index({ mailchimpSynced: 1, createdAt: 1 });

const EarlyAccess = mongoose.model('EarlyAccess', earlyAccessSchema);

export default EarlyAccess;
