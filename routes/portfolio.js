import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Create a new portfolio/profile
router.post('/create', async (req, res) => {
  try {
    const {
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

    // Validate required fields
    if (!fullName || !location || !experience || !role || !purpose || !availability) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Create new user profile
    const newUser = new User({
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
    console.error('Error creating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create profile',
      error: error.message
    });
  }
});

// Get a profile by ID
router.get('/:id', async (req, res) => {
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
router.get('/', async (req, res) => {
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
