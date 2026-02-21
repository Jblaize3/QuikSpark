import express from 'express';
import CollabRequest from '../models/CollabRequest.js';
import User from '../models/User.js';

const router = express.Router();

// Send a collaboration request
router.post('/send', async (req, res) => {
  try {
    const { fromUserId, toUserId, portfolioItemId, message, need, timeline } = req.body;
    
    // Validation
    if (!fromUserId || !toUserId) {
      return res.status(400).json({
        success: false,
        message: 'From and To user IDs are required'
      });
    }
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }
    
    if (fromUserId === toUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send request to yourself'
      });
    }
    
    // Check if users exist
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);
    
    if (!fromUser || !toUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check for duplicate pending request
    const existingRequest = await CollabRequest.findOne({
      fromUser: fromUserId,
      toUser: toUserId,
      status: 'pending'
    });
    
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending request with this person'
      });
    }
    
    // Create request
    const collabRequest = new CollabRequest({
      fromUser: fromUserId,
      toUser: toUserId,
      portfolioItem: portfolioItemId || null,
      message: message.trim(),
      need: need || null,
      timeline: timeline || null,
      status: 'pending'
    });
    
    await collabRequest.save();
    
    res.json({
      success: true,
      message: 'Collaboration request sent!',
      request: collabRequest
    });
    
  } catch (error) {
    console.error('Error sending collab request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send request',
      error: error.message
    });
  }
});

// Get all requests received by a user (inbox)
router.get('/received/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query; // optional filter
    
    const query = { toUser: userId };
    if (status) {
      query.status = status;
    }
    
    const requests = await CollabRequest.find(query)
      .populate('fromUser', 'fullName role location profileImage experience availability')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      requests
    });
    
  } catch (error) {
    console.error('Error fetching received requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: error.message
    });
  }
});

// Get all requests sent by a user
router.get('/sent/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const requests = await CollabRequest.find({ fromUser: userId })
      .populate('toUser', 'fullName role location profileImage')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      requests
    });
    
  } catch (error) {
    console.error('Error fetching sent requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: error.message
    });
  }
});

// Accept a collaboration request
router.post('/accept/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.body; // User accepting (should be toUser)
    
    const request = await CollabRequest.findById(requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }
    
    // Verify the user accepting is the recipient
    if (request.toUser.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept this request'
      });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been responded to'
      });
    }
    
    request.status = 'accepted';
    request.respondedAt = new Date();
    await request.save();
    
    res.json({
      success: true,
      message: 'Request accepted!',
      request
    });
    
  } catch (error) {
    console.error('Error accepting request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept request',
      error: error.message
    });
  }
});

// Decline a collaboration request
router.post('/decline/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.body; // User declining (should be toUser)
    
    const request = await CollabRequest.findById(requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }
    
    // Verify the user declining is the recipient
    if (request.toUser.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to decline this request'
      });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been responded to'
      });
    }
    
    request.status = 'declined';
    request.respondedAt = new Date();
    await request.save();
    
    res.json({
      success: true,
      message: 'Request declined',
      request
    });
    
  } catch (error) {
    console.error('Error declining request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decline request',
      error: error.message
    });
  }
});

export default router;
