import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mailchimp from "@mailchimp/mailchimp_marketing";
import MatchmakingService from "./matchmaking-service.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import EarlyAccess from './models/EarlyAccess.js';
import connectDB from './config/database.js';
import portfolioRoutes from './routes/portfolio.js';
import shortlistRoutes from './routes/shortlist.js';
import mockRoutes from './routes/mock.js';
import engagementRoutes from './routes/engagement.js';
import collabRoutes from './routes/collab.js';
import messageRoutes from './routes/messages.js';
import sparkRoutes from './routes/sparks.js';
import stripeRoutes from './routes/stripe.js';
import authRoutes from './routes/auth.js';
import paymentRoutes, { webhookHandler } from './routes/payments.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mcKey = process.env.MAILCHIMP_API_KEY;
mailchimp.setConfig({
    apiKey: mcKey,
    server: mcKey?.split("-").pop()
});

process.on('uncaughtException', function (err) {
    console.error('Caught exception:', err.stack);
    process.exit(1);
});

const app = express();

// Render sits behind a proxy; this makes req.ip the real client address for rate limits
app.set('trust proxy', 1);

// Stripe webhook needs the raw request body, so it goes before express.json()
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), webhookHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use('/api/auth', authRoutes);
app.use('/api/sparks', sparkRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shortlist', shortlistRoutes);
app.use('/api/mock', mockRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/collab', collabRoutes);
app.use('/api/messages', messageRoutes);

connectDB();

app.use('/api/portfolio', portfolioRoutes);
app.use(express.static(path.join(__dirname, 'public')));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get("/api/health", (req, res) => {
    res.json({ status: "🔥 QuikSpark backend is running!", timestamp: new Date() });
});

app.get("/profile/:userId", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "profile.html"));
});

const MAILCHIMP_LIST_ID = "78887fb73a";

// Push one saved signup to Mailchimp and record the outcome on the document.
// Never throws: a Mailchimp failure just leaves the signup flagged for retry.
async function syncToMailchimp(signup) {
    try {
        await mailchimp.lists.addListMember(MAILCHIMP_LIST_ID, {
            email_address: signup.email,
            status: "subscribed",
            merge_fields: { FNAME: signup.firstName, LNAME: signup.lastName },
            tags: signup.interests || []
        });
        signup.mailchimpSynced = true;
        signup.mailchimpSyncedAt = new Date();
        signup.mailchimpLastError = null;
    } catch (error) {
        const body = error.response?.body;
        if (error.status === 400 && body?.title === "Member Exists") {
            // Already on the Mailchimp list, so nothing left to sync
            signup.mailchimpSynced = true;
            signup.mailchimpSyncedAt = new Date();
            signup.mailchimpLastError = null;
        } else {
            signup.mailchimpLastError = (body?.title ? `${body.title}: ${body.detail || ""}` : error.message || "Unknown error").slice(0, 500);
            console.error("Mailchimp sync failed for", signup.email, "-", signup.mailchimpLastError);
        }
    }
    signup.mailchimpAttempts = (signup.mailchimpAttempts || 0) + 1;
    await signup.save();
    return signup.mailchimpSynced;
}

app.post("/api/early-access", async (req, res) => {
    try {
        const { firstName, lastName, email, interests } = req.body;
        if (!firstName || !lastName || !email) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const existing = await EarlyAccess.findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(400).json({ success: false, message: "This email is already registered for early access!" });
        }

        // 1. Save to MongoDB first. This is the source of truth.
        const signup = await EarlyAccess.create({
            firstName: String(firstName).trim(),
            lastName: String(lastName).trim(),
            email: normalizedEmail,
            interests: Array.isArray(interests) ? interests : []
        });
        console.log("Saved early access signup:", normalizedEmail);

        // 2. Sync to Mailchimp second. A failure here does not fail the signup.
        await syncToMailchimp(signup);

        res.json({ success: true, message: "Successfully subscribed to early access!" });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "This email is already registered for early access!" });
        }
        console.error("Early access error:", error.message);
        res.status(500).json({ success: false, message: "Failed to subscribe. Please try again later." });
    }
});

// Retry any signups that never made it to Mailchimp (outage, billing lapse, etc.)
async function retryUnsyncedSignups() {
    try {
        if (mongoose.connection.readyState !== 1) return;
        const pending = await EarlyAccess.find({ mailchimpSynced: false }).sort({ createdAt: 1 }).limit(50);
        if (!pending.length) return;
        let synced = 0;
        for (const signup of pending) {
            if (await syncToMailchimp(signup)) synced++;
        }
        console.log(`Mailchimp retry: ${synced}/${pending.length} pending signups synced`);
    } catch (error) {
        console.error("Mailchimp retry error:", error.message);
    }
}

setTimeout(retryUnsyncedSignups, 30 * 1000);
setInterval(retryUnsyncedSignups, 15 * 60 * 1000);

const matchmaker = new MatchmakingService(process.env.ANTHROPIC_API_KEY);

app.post("/api/match/analyze", requireAuth, async (req, res) => {
    try {
        const { user1, user2 } = req.body;
        if (!user1 || !user2) {
            return res.status(400).json({ success: false, message: "Both user profiles are required" });
        }
        const matchResult = await matchmaker.matchUsers(user1, user2);
        res.json({ success: true, match: matchResult });
    } catch (error) {
        console.error("Match analysis error:", error);
        res.status(500).json({ success: false, message: "Failed to analyze match" });
    }
});

app.post("/api/test/match", requireAuth, async (req, res) => {
    try {
        const mockUsers = [
            {
                email: "sarah@example.com",
                firstName: "Sarah",
                lastName: "Chen",
                role: "Technical Co-founder",
                skills: ["Full-stack development", "AI/ML", "Product design"],
                interests: ["SaaS", "Healthcare tech"],
                lookingFor: "Business co-founder",
                goals: "Build healthcare AI platform",
                experience: "5 years as senior engineer",
                workingStyle: "Data-driven, collaborative",
                availability: "20+ hours/week"
            },
            {
                email: "mike@example.com",
                firstName: "Mike",
                lastName: "Rodriguez",
                role: "Business Co-founder",
                skills: ["Business development", "Sales", "Healthcare"],
                interests: ["Healthcare tech", "B2B SaaS"],
                lookingFor: "Technical co-founder",
                goals: "Make healthcare accessible",
                experience: "8 years in healthcare",
                workingStyle: "Results-oriented",
                availability: "Full-time"
            }
        ];
        const matchResult = await matchmaker.matchUsers(mockUsers[0], mockUsers[1]);
        res.json({ success: true, message: "Test match between Sarah (technical) and Mike (business)", match: matchResult });
    } catch (error) {
        console.error("Test match error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
