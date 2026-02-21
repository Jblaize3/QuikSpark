import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Track portfolio item view
router.post('/view/:userId/:itemId', async (req, res) => {
  try {
    const { userId, itemId } = req.params;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const item = user.uploadedFiles.id(itemId);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    // Increment view count
    item.views = (item.views || 0) + 1;
    await user.save({ validateModifiedOnly: true });

    res.json({
      success: true,
      views: item.views
    });

  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track view',
      error: error.message
    });
  }
});

// Express interest in collaborating on a portfolio item
router.post('/interest/:userId/:itemId', async (req, res) => {
  try {
    const { userId, itemId } = req.params;
    const { interestedUserId } = req.body; // User expressing interest
    
    if (!interestedUserId) {
      return res.status(400).json({
        success: false,
        message: 'Interested user ID required'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const item = user.uploadedFiles.id(itemId);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    // Check if already interested
    const alreadyInterested = item.interestedUsers?.some(
      interest => interest.userId.toString() === interestedUserId
    );

    if (alreadyInterested) {
      return res.status(400).json({
        success: false,
        message: 'Already expressed interest'
      });
    }

    // Add interest
    if (!item.interestedUsers) {
      item.interestedUsers = [];
    }
    
    item.interestedUsers.push({
      userId: interestedUserId,
      interestedAt: new Date()
    });

    await user.save({ validateModifiedOnly: true });

    res.json({
      success: true,
      message: 'Interest recorded!',
      interestedCount: item.interestedUsers.length
    });

  } catch (error) {
    console.error('Error recording interest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record interest',
      error: error.message
    });
  }
});

// Remove interest
router.post('/remove-interest/:userId/:itemId', async (req, res) => {
  try {
    const { userId, itemId } = req.params;
    const { interestedUserId } = req.body;
    
    if (!interestedUserId) {
      return res.status(400).json({
        success: false,
        message: 'Interested user ID required'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const item = user.uploadedFiles.id(itemId);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    // Remove interest
    item.interestedUsers = item.interestedUsers.filter(
      interest => interest.userId.toString() !== interestedUserId
    );

    await user.save({ validateModifiedOnly: true });

    res.json({
      success: true,
      message: 'Interest removed',
      interestedCount: item.interestedUsers.length
    });

  } catch (error) {
    console.error('Error removing interest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove interest',
      error: error.message
    });
  }
});

export default router;
