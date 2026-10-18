import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // Step 1: Basics
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  experience: {
    type: String,
    required: true,
    enum: ['0', '1-2', '3-5', '6-10', '10+']
  },
  role: {
    type: String,
    required: true,
    trim: true
  },

  // Step 2: Profile Image
  profileImage: {
    type: String, // URL to image in storage
    default: null
  },

  // Step 3: Purpose
  purpose: {
    type: String,
    required: true,
    enum: ['find-cofounder', 'collaborate-projects', 'find-talent', 'networking']
  },

  // Step 4: Interests
  interests: [{
    type: String,
    enum: [
      'ai-tech',
      'apps-software',
      'content-media',
      'film-video',
      'creative-arts',
      'graphic-design',
      'music-audio',
      'photography',
      'fashion-beauty',
      'food-beverage',
      'fitness-wellness',
      'gaming-esports',
      'ecommerce-retail',
      'social-impact',
      'education',
      'finance-crypto'
    ]
  }],
  preferences: {
    type: String,
    trim: true
  },

  // Step 5: Work Style
  availability: {
    type: String,
    required: true,
    enum: ['full-time', 'part-time', 'weekends', 'flexible']
  },
  workStyle: {
    type: String,
    trim: true
  },

  // Step 6: Portfolio
  workTypes: [{
    type: String,
    enum: [
      'prototype',
      'live-product',
      'experiment-mvp',
      'client-work',
      'open-source',
      'research',
      'concept'
    ]
  }],
  uploadedFiles: [{
    filename: String,
    url: String,
    uploadedAt: Date,
    caption: {
      type: String,
      maxlength: 120,  // Keep it concise - 1 line
      trim: true
    },
    views: {
      type: Number,
      default: 0
    },
    interestedUsers: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      interestedAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  vision: {
    type: String,
    trim: true
  },

  // Shortlisted profiles (users this person saved)
  shortlistedProfiles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
    isActive: {
    type: Boolean,
    default: true
  },
  stripeAccountId: {
    type: String,
    default: null
  },
  stripeOnboardingComplete: {
    type: Boolean,
    default: false
  },

  // Login. Optional at the schema level so profiles created before logins existed
  // still load. The signup route requires both. Leave email unset (never null) for
  // those profiles so the sparse unique index ignores them.
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true
  },
  passwordHash: {
    type: String,
    select: false
  }
}, {
  timestamps: true,
  toJSON: {
    // Profiles are returned to other users all over the app (discover, shortlist,
    // populated requests). Never let private fields leave the server.
    transform(doc, ret) {
      delete ret.passwordHash;
      delete ret.email;
      delete ret.stripeAccountId;
      return ret;
    }
  }
});

// Indexes for faster queries
userSchema.index({ interests: 1 });
userSchema.index({ purpose: 1 });
userSchema.index({ availability: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);

export default User;