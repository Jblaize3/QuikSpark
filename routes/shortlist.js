import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Add profile to shortlist
router.post('/add/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { userId } = req.body; // Current user's ID
    
    console.log('🔍 Shortlist request:', { userId, profileId, body: req.body });

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID required'
      });
    }

// Find the user and add to their shortlist
const user = await User.findById(userId);

if (!user) {
  return res.status(404).json({
    success: false,
    message: 'User not found'
  });
}

// Initialize shortlistedProfiles if it doesn't exist
if (!user.shortlistedProfiles) {
  user.shortlistedProfiles = [];
}

// Check if already shortlisted
if (user.shortlistedProfiles.includes(profileId)) {
  return res.status(400).json({
    success: false,
    message: 'Profile already shortlisted'
  });
}

// Add to shortlist
user.shortlistedProfiles.push(profileId);
await user.save({ validateModifiedOnly: true });

    res.json({
      success: true,
      message: 'Profile added to shortlist',
      shortlistedProfiles: user.shortlistedProfiles
    });

  } catch (error) {
    console.error('Error adding to shortlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add to shortlist',
      error: error.message
    });
  }
});

// Remove profile from shortlist
router.post('/remove/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID required'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove from shortlist
    user.shortlistedProfiles = user.shortlistedProfiles.filter(
      id => id.toString() !== profileId
    );
    await user.save();

    res.json({
      success: true,
      message: 'Profile removed from shortlist',
      shortlistedProfiles: user.shortlistedProfiles
    });

  } catch (error) {
    console.error('Error removing from shortlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove from shortlist',
      error: error.message
    });
  }
});

// Get all shortlisted profiles for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).populate('shortlistedProfiles');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      shortlistedProfiles: user.shortlistedProfiles
    });

  } catch (error) {
    console.error('Error fetching shortlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shortlist',
      error: error.message
    });
  }
});

export default router;
