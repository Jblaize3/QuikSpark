import mongoose from 'mongoose';

const SparkSchema = new mongoose.Schema({
    // Author info (denormalized for fast feed rendering)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio',
        required: true
    },
    authorName: { type: String, required: true },
    authorRole: { type: String, default: '' },
    authorImage: { type: String, default: '' },

    // Spark fields
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    whyNow: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
    },
    stage: {
        type: String,
        enum: ['concept', 'prototype', 'building', 'launched'],
        required: true
    },
    lookingFor: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },
    timeline: {
        type: String,
        default: ''
    },
    compensation: {
        type: String,
        enum: ['paid', 'passion-project', 'tbd'],
        default: 'tbd'
    },
    tags: {
        type: String,
        default: ''
    },

    // Engagement
    interestedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio'
    }],
    interestCount: {
        type: Number,
        default: 0
    },

    // Status
    isActive: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

// Index for fast feed queries
SparkSchema.index({ createdAt: -1 });
SparkSchema.index({ stage: 1, createdAt: -1 });
SparkSchema.index({ compensation: 1, createdAt: -1 });

export default mongoose.model('Spark', SparkSchema);
