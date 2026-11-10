import express from 'express';
import mongoose from 'mongoose';
import CollabRequest from '../models/CollabRequest.js';
import User from '../models/User.js';
import { requireAuth, matchesAuth } from '../middleware/auth.js';
import { notifyRequestReceived, notifyRequestAccepted } from '../lib/notify.js';
import { consumeUsage, refundUsage, dayKey, envInt } from '../lib/usage.js';

const router = express.Router();

// Launch limits on cold outreach. Replying to requests you receive is never limited.
const REQUEST_DAILY_LIMIT = envInt('REQUEST_DAILY_LIMIT', 10);
const DECLINED_COOLDOWN_DAYS = envInt('REQUEST_DECLINED_COOLDOWN_DAYS', 30);

// Send a collaboration request
router.post('/send', requireAuth, matchesAuth('body', 'fromUserId'), async (req, res) => {
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
    
    // Look at everything between these two people before creating anything new
    const history = await CollabRequest.find({
      $or: [
        { fromUser: fromUserId, toUser: toUserId },
        { fromUser: toUserId, toUser: fromUserId }
      ],
      status: { $in: ['pending', 'accepted', 'declined'] }
    }).sort({ createdAt: -1 });

    const connected = history.find((r) => r.status === 'accepted');
    if (connected) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_CONNECTED',
        collabRequestId: connected._id,
        message: 'You already have a conversation with this person. Find it on My Spark.'
      });
    }

    if (history.some((r) => r.status === 'pending' && String(r.fromUser) === String(fromUserId))) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending request with this person'
      });
    }

    if (history.some((r) => r.status === 'pending' && String(r.fromUser) === String(toUserId))) {
      return res.status(409).json({
        success: false,
        code: 'THEY_REQUESTED',
        message: 'They already sent you a request. Check My Spark to accept it.'
      });
    }

    const lastDeclined = history.find((r) => r.status === 'declined' && String(r.fromUser) === String(fromUserId));
    if (lastDeclined && DECLINED_COOLDOWN_DAYS > 0) {
      const respondedAt = (lastDeclined.respondedAt || lastDeclined.createdAt).getTime();
      const retryAt = respondedAt + DECLINED_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() < retryAt) {
        const daysLeft = Math.ceil((retryAt - Date.now()) / (24 * 60 * 60 * 1000));
        return res.status(409).json({
          success: false,
          code: 'RECENTLY_DECLINED',
          message: `They declined your last request. You can try again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
        });
      }
    }

    // Daily limit on new requests, so nobody can mass-message the whole directory
    const usageKey = `request:user:${fromUserId}:${dayKey()}`;
    const allowance = await consumeUsage(usageKey, REQUEST_DAILY_LIMIT);
    if (!allowance.ok) {
      return res.status(429).json({
        success: false,
        code: 'REQUEST_LIMIT',
        message: `You can send ${REQUEST_DAILY_LIMIT} new requests a day. Try again tomorrow.`
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
    
    try {
      await collabRequest.save();
    } catch (saveError) {
      await refundUsage(usageKey).catch(() => {});
      throw saveError;
    }
    notifyRequestReceived(collabRequest);
    
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
router.get('/received/:userId', requireAuth, matchesAuth('params', 'userId'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query; // optional filter
    
    // Requests the sender took back are not shown to the person who received them
    const query = { toUser: userId, status: status && status !== 'withdrawn' ? status : { $ne: 'withdrawn' } };
    
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
router.get('/sent/:userId', requireAuth, matchesAuth('params', 'userId'), async (req, res) => {
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
router.post('/accept/:requestId', requireAuth, matchesAuth('body', 'userId'), async (req, res) => {
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
    notifyRequestAccepted(request);
    
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

// Withdraw a request you sent, as long as nobody has answered it yet
router.post('/withdraw/:requestId', requireAuth, matchesAuth('body', 'userId'), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.body;

    const request = mongoose.isValidObjectId(requestId) ? await CollabRequest.findById(requestId) : null;
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (request.fromUser.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Only the person who sent a request can withdraw it' });
    }

    // Matching on status makes this safe if the other person accepts at the same moment
    const updated = await CollabRequest.findOneAndUpdate(
      { _id: request._id, status: 'pending' },
      { status: 'withdrawn', respondedAt: new Date() },
      { returnDocument: 'after' }
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: 'This request has already been answered' });
    }

    res.json({ success: true, message: 'Request withdrawn', request: updated });
  } catch (error) {
    console.error('Error withdrawing request:', error);
    res.status(500).json({ success: false, message: 'Failed to withdraw request' });
  }
});

// Decline a collaboration request
router.post('/decline/:requestId', requireAuth, matchesAuth('body', 'userId'), async (req, res) => {
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
