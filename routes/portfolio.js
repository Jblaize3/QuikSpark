import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { issueSession, requireAuth, rateLimit } from '../middleware/auth.js';

const router = express.Router();

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many sign-up attempts. Please try again later.'
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Create a new account + profile, and log the new user in
router.post('/create', signupLimiter, async (req, res) => {
  try {
    const {
      email: rawEmail,
      password,
      fullName,
      location,
      experience,
      role,
      profileImage,
      purpose,
      interests,
      preferences,
      availability,
      workStyle,
      workTypes,
      uploadedFiles,
      vision
    } = req.body;

    const email = String(rawEmail || '').trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    if (password.length > 72) {
      return res.status(400).json({ success: false, message: 'Password must be 72 characters or fewer' });
    }
    if (await User.exists({ email })) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Try logging in instead.' });
    }

    // Validate required fields
    if (!fullName || !location || !experience || !role || !purpose || !availability) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Create new user profile
    const newUser = new User({
      email,
      passwordHash: await bcrypt.hash(password, 12),
      fullName,
      location,
      experience,
      role,
      profileImage,
      purpose,
      interests: interests || [],
      preferences,
      availability,
      workStyle,
      workTypes: workTypes || [],
      uploadedFiles: uploadedFiles || [],
      vision
    });

    await newUser.save();
    issueSession(res, newUser._id);

    res.status(201).json({
      success: true,
      message: 'Profile created successfully',
      userId: newUser._id,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        role: newUser.role,
        interests: newUser.interests
      }
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Try logging in instead.' });
    }
    console.error('Error creating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create profile',
      error: error.message
    });
  }
});

// Get a profile by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

// Get all active profiles (for discovery/swipe interface)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 10, skip = 0 } = req.query;

    const users = await User.find({ isActive: true })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ createdAt: -1 })
      .select('-__v'); // Exclude version key

    const total = await User.countDocuments({ isActive: true });

    res.json({
      success: true,
      users,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > (parseInt(skip) + parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles',
      error: error.message
    });
  }
});

export default router;
