import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import CollabRequest from '../models/CollabRequest.js';

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/messages/thread/:collabRequestId
// Fetch all messages in a thread
// Hard rule: only works if collabRequest is accepted
// ─────────────────────────────────────────────
router.get('/thread/:collabRequestId', async (req, res) => {
  try {
    const { collabRequestId } = req.params;
    const { userId } = req.query; // Who's asking

    const collabRequest = await CollabRequest.findById(collabRequestId);

    if (!collabRequest) {
      return res.status(404).json({ success: false, message: 'Collaboration request not found' });
    }

    // Hard rule: messaging only unlocks after acceptance
    if (collabRequest.status !== 'accepted') {
      return res.status(403).json({
        success: false,
        message: 'Messaging is only available after a collaboration request is accepted'
      });
    }

    // Verify the requesting user is a participant
    const isParticipant =
      collabRequest.fromUser.toString() === userId ||
      collabRequest.toUser.toString() === userId;

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this thread' });
    }

    const messages = await Message.find({ collabRequest: collabRequestId })
      .populate('sender', 'fullName profileImage role')
      .sort({ createdAt: 1 }); // Oldest first for natural conversation flow

    // Mark unread messages as read (quiet — no timestamp, just flips the boolean)
    await Message.updateMany(
      {
        collabRequest: collabRequestId,
        sender: { $ne: userId }, // Not sent by the viewer
        readByRecipient: false
      },
      { readByRecipient: true }
    );

    res.json({ success: true, messages });

  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages', error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/messages/send
// Send a message in an accepted thread
// ─────────────────────────────────────────────
router.post('/send', async (req, res) => {
  try {
    const { collabRequestId, senderId, body } = req.body;

    if (!collabRequestId || !senderId || !body?.trim()) {
      return res.status(400).json({ success: false, message: 'collabRequestId, senderId, and body are required' });
    }

    const collabRequest = await CollabRequest.findById(collabRequestId);

    if (!collabRequest) {
      return res.status(404).json({ success: false, message: 'Collaboration request not found' });
    }

    // Hard rule: no messages until accepted
    if (collabRequest.status !== 'accepted') {
      return res.status(403).json({
        success: false,
        message: 'Messaging is only available after a collaboration request is accepted'
      });
    }

    // Verify sender is a participant
    const isParticipant =
      collabRequest.fromUser.toString() === senderId ||
      collabRequest.toUser.toString() === senderId;

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not authorized to send messages in this thread' });
    }

    const message = new Message({
      collabRequest: collabRequestId,
      participants: [collabRequest.fromUser, collabRequest.toUser],
      sender: senderId,
      body: body.trim()
    });

    await message.save();

    // Return populated message so frontend can render immediately
    const populated = await message.populate('sender', 'fullName profileImage role');

    res.status(201).json({ success: true, message: populated });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/messages/inbox/:userId
// Get all active threads for a user
// Returns one entry per thread, with latest message preview
// ─────────────────────────────────────────────
router.get('/inbox/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all accepted collab requests this user is part of
    const acceptedRequests = await CollabRequest.find({
      status: 'accepted',
      $or: [{ fromUser: userId }, { toUser: userId }]
    })
      .populate('fromUser', 'fullName profileImage role')
      .populate('toUser', 'fullName profileImage role')
      .sort({ respondedAt: -1 });

    // For each thread, get the latest message and unread count
    const threads = await Promise.all(
      acceptedRequests.map(async (request) => {
        const latestMessage = await Message.findOne({ collabRequest: request._id })
          .sort({ createdAt: -1 })
          .populate('sender', 'fullName');

        // Unread = messages sent by the other person that haven't been read
        const unreadCount = await Message.countDocuments({
          collabRequest: request._id,
          sender: { $ne: new mongoose.Types.ObjectId(userId) },
          readByRecipient: false
        });

        // Determine the other participant
        const otherUser =
          request.fromUser._id.toString() === userId
            ? request.toUser
            : request.fromUser;

        return {
          collabRequestId: request._id,
          otherUser,
          latestMessage: latestMessage
            ? {
                body: latestMessage.body,
                sender: latestMessage.sender,
                createdAt: latestMessage.createdAt
              }
            : null,
          hasUnread: unreadCount > 0, // Quiet dot, not a number
          startedAt: request.respondedAt
        };
      })
    );

    res.json({ success: true, threads });

  } catch (error) {
    console.error('Error fetching inbox:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch inbox', error: error.message });
  }
});

export default router;