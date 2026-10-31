import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mailchimp from "@mailchimp/mailchimp_marketing";
import MatchmakingService, { profileFromUser } from "./matchmaking-service.js";
import User from './models/User.js';
import { consumeUsage, refundUsage, dayKey, envInt } from './lib/usage.js';
import dotenv from "dotenv";
import mongoose from "mongoose";
import EarlyAccess from './models/EarlyAccess.js';
import connectDB from './config/database.js';
import portfolioRoutes from './routes/portfolio.js';
import shortlistRoutes from './routes/shortlist.js';
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

// The site and its API share one origin, so browsers never need CORS for our own
// pages. Only the addresses below (plus anything in ALLOWED_ORIGINS, comma
// separated) are allowed to call the API from another origin. Requests with no
// Origin header (same-origin, curl, Stripe) are unaffected.
const allowedOrigins = new Set([
    'https://quik-spark.com',
    'https://www.quik-spark.com',
    ...(process.env.BASE_URL ? [process.env.BASE_URL.trim().replace(/\/+$/, '')] : []),
    ...(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)
]);
const isProd = process.env.NODE_ENV === 'production' || !!process.env.RENDER;
app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
        return callback(null, false);
    },
    credentials: true
}));
app.use('/api/auth', authRoutes);
app.use('/api/sparks', sparkRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shortlist', shortlistRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/collab', collabRoutes);
app.use('/api/messages', messageRoutes);

connectDB();

app.use('/api/portfolio', portfolioRoutes);

// Typed addresses without .html (quik-spark.com/about) go to the real page
app.get(/^\/(about|login|discover|myspark|spark-feed|profile-setup|thread)\/?$/, (req, res) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, `/${req.params[0]}.html${query}`);
});

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

let matchmaker = new MatchmakingService(process.env.ANTHROPIC_API_KEY);
export function setMatchmaker(fake) { matchmaker = fake; }

// Every analysis costs real money, so it is capped per person and for the whole
// site per day. These are launch caps; they become plan limits once Pro exists.
const MATCH_PER_USER_PER_DAY = envInt('MATCH_DAILY_LIMIT_PER_USER', 5);
const MATCH_SITE_PER_DAY = envInt('MATCH_DAILY_LIMIT_GLOBAL', 100);

// Body: { otherUserId }. The logged-in user is always one side; both profiles are
// read from the database, never taken from the request.
app.post("/api/match/analyze", requireAuth, async (req, res) => {
    const day = dayKey();
    const userKey = `match:user:${req.auth.userId}:${day}`;
    const siteKey = `match:site:${day}`;
    let userCharged = false;
    let siteCharged = false;
    try {
        const otherUserId = String(req.body?.otherUserId || '');
        if (!mongoose.isValidObjectId(otherUserId)) {
            return res.status(400).json({ success: false, message: "otherUserId is required" });
        }
        if (otherUserId === req.auth.userId) {
            return res.status(400).json({ success: false, message: "Pick someone other than yourself" });
        }

        const [me, other] = await Promise.all([
            User.findById(req.auth.userId),
            User.findById(otherUserId)
        ]);
        if (!me) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Please log in to continue' });
        if (!other || other.isActive === false) {
            return res.status(404).json({ success: false, message: "That profile was not found" });
        }

        const mine = await consumeUsage(userKey, MATCH_PER_USER_PER_DAY);
        if (!mine.ok) {
            return res.status(429).json({
                success: false,
                code: 'MATCH_LIMIT',
                message: `You've used all ${MATCH_PER_USER_PER_DAY} match analyses for today. Try again tomorrow.`
            });
        }
        userCharged = true;

        const site = await consumeUsage(siteKey, MATCH_SITE_PER_DAY);
        if (!site.ok) {
            await refundUsage(userKey);
            userCharged = false;
            return res.status(429).json({
                success: false,
                code: 'MATCH_BUSY',
                message: "AI matching is at capacity right now. Please try again tomorrow."
            });
        }
        siteCharged = true;

        const matchResult = await matchmaker.matchUsers(profileFromUser(me), profileFromUser(other));
        res.json({ success: true, match: matchResult, remainingToday: MATCH_PER_USER_PER_DAY - mine.count });
    } catch (error) {
        console.error("Match analysis error:", error);
        // The person got nothing, so they don't lose a use
        try {
            if (userCharged) await refundUsage(userKey);
            if (siteCharged) await refundUsage(siteKey);
        } catch (e) { console.error("Usage refund failed:", e); }
        res.status(500).json({ success: false, message: "Failed to analyze match" });
    }
});

// Anything nothing else answered: JSON for the API, a friendly page for everything else
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
