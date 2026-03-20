import express from 'express';
import Spark from '../models/Spark.js';
import mongoose from 'mongoose';

const router = express.Router();

// ─── GET /api/sparks ─────────────────────────────────────
// Fetch all active sparks, newest first
router.get('/', async (req, res) => {
    try {
        const { stage, compensation, limit = 50 } = req.query;

        const query = { isActive: true };
        if (stage && stage !== 'all') query.stage = stage;
        if (compensation && compensation !== 'all') query.compensation = compensation;

        const sparks = await Spark.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json({ success: true, sparks });

    } catch (error) {
        console.error('Get sparks error:', error);
        res.status(500).json({ success: false, message: 'Failed to load sparks' });
    }
});

// ─── POST /api/sparks ────────────────────────────────────
// Create a new spark
router.post('/', async (req, res) => {
    try {
        const { userId, title, whyNow, stage, lookingFor, timeline, compensation, tags } = req.body;

        if (!userId || !title || !stage || !lookingFor) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, stage and lookingFor are required'
            });
        }

        // Fetch author info from portfolio
        const Portfolio = mongoose.model('Portfolio');
        const author = await Portfolio.findById(userId).lean();

        if (!author) {
            return res.status(404).json({ success: false, message: 'User profile not found' });
        }

        const spark = new Spark({
            userId,
            authorName: author.fullName,
            authorRole: author.role || '',
            authorImage: author.profileImage || '',
            title: title.trim(),
            whyNow: whyNow ? whyNow.trim() : '',
            stage,
            lookingFor: lookingFor.trim(),
            timeline: timeline || '',
            compensation: compensation || 'tbd',
            tags: tags ? tags.trim() : ''
        });

        await spark.save();

        res.status(201).json({ success: true, spark });

    } catch (error) {
        console.error('Create spark error:', error);
        res.status(500).json({ success: false, message: 'Failed to create spark' });
    }
});

// ─── POST /api/sparks/:id/interest ───────────────────────
// Express interest in a spark
router.post('/:id/interest', async (req, res) => {
    try {
        const { userId } = req.body;
        const { id } = req.params;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID required' });
        }

        const spark = await Spark.findById(id);

        if (!spark) {
            return res.status(404).json({ success: false, message: 'Spark not found' });
        }

        // Prevent duplicate interest
        if (spark.interestedUsers.includes(userId)) {
            return res.status(400).json({ success: false, message: 'Already expressed interest in this Spark' });
        }

        // Prevent interest in your own spark
        if (spark.userId.toString() === userId) {
            return res.status(400).json({ success: false, message: 'You cannot express interest in your own Spark' });
        }

        spark.interestedUsers.push(userId);
        spark.interestCount = spark.interestedUsers.length;
        await spark.save();

        res.json({ success: true, interestCount: spark.interestCount });

    } catch (error) {
        console.error('Express interest error:', error);
        res.status(500).json({ success: false, message: 'Failed to express interest' });
    }
});

// ─── DELETE /api/sparks/:id ───────────────────────────────
// Deactivate a spark (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const { userId } = req.body;
        const { id } = req.params;

        const spark = await Spark.findById(id);

        if (!spark) {
            return res.status(404).json({ success: false, message: 'Spark not found' });
        }

        if (spark.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this Spark' });
        }

        spark.isActive = false;
        await spark.save();

        res.json({ success: true, message: 'Spark removed' });

    } catch (error) {
        console.error('Delete spark error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove spark' });
    }
});

export default router;
