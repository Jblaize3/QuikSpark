import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // The collab request that unlocked this thread
  // Hard rule: thread only exists after collabRequest.status === 'accepted'
  collabRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CollabRequest',
    required: true
  },

  // The two participants (derived from collabRequest, stored for query efficiency)
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],

  // Who sent this message
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Message content
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },

  // Quiet read receipt — sender knows it was seen, no anxiety for recipient
  // No timestamp, no "seen at X:XX" — just a boolean
  readByRecipient: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true // createdAt, updatedAt — consistent with User.js
});

// Fetch all messages in a thread efficiently
messageSchema.index({ collabRequest: 1, createdAt: 1 });

// Find unread messages for a user across all threads
messageSchema.index({ participants: 1, readByRecipient: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
