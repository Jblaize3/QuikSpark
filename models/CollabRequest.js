import mongoose from 'mongoose';

const collabRequestSchema = new mongoose.Schema({
  // Who's requesting
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Who they're requesting from (the creator)
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Optional: which portfolio item they're interested in
  portfolioItem: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  
  // Required: their pitch/message
  message: {
    type: String,
    required: true,
    maxlength: 500,
    trim: true
  },
  
  // What they need help with
  need: {
    type: String,
    enum: ['design', 'pm', 'engineering', 'marketing', 'other'],
    required: false
  },
  
  // When they want to start
  timeline: {
    type: String,
    enum: ['asap', '1-2-weeks', '1-month', 'flexible'],
    required: false
  },
  
  // Request status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  
  // When request was created
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // When status changed
  respondedAt: {
    type: Date
  }
});

// Index for efficient queries
collabRequestSchema.index({ toUser: 1, status: 1, createdAt: -1 });
collabRequestSchema.index({ fromUser: 1, createdAt: -1 });

const CollabRequest = mongoose.model('CollabRequest', collabRequestSchema);

export default CollabRequest;
