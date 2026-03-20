import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mailchimp from "@mailchimp/mailchimp_marketing";
import MatchmakingService from "./matchmaking-service.js";
import dotenv from "dotenv";
import connectDB from './config/database.js';
import portfolioRoutes from './routes/portfolio.js';
import shortlistRoutes from './routes/shortlist.js';
import mockRoutes from './routes/mock.js';
import engagementRoutes from './routes/engagement.js';
import collabRoutes from './routes/collab.js';
import messageRoutes from './routes/messages.js';
import sparkRoutes from './routes/sparks.js';

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use('/api/sparks', sparkRoutes);
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

app.post("/api/early-access", async (req, res) => {
    try {
        const { firstName, lastName, email, interests } = req.body;
        if (!firstName || !lastName || !email) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        await mailchimp.lists.addListMember("78887fb73a", {
            email_address: email,
            status: "subscribed",
            merge_fields: { FNAME: firstName, LNAME: lastName },
            tags: interests || []
        });
        console.log("Successfully added contact:", email);
        res.json({ success: true, message: "Successfully subscribed to early access!" });
    } catch (error) {
        console.error("Mailchimp Error:", error.response?.body || error.message);
        if (error.status === 400 && error.response?.body?.title === "Member Exists") {
            return res.status(400).json({ success: false, message: "This email is already registered for early access!" });
        }
        res.status(500).json({ success: false, message: "Failed to subscribe. Please try again later." });
    }
});

const matchmaker = new MatchmakingService(process.env.ANTHROPIC_API_KEY);

app.post("/api/match/analyze", async (req, res) => {
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

app.post("/api/test/match", async (req, res) => {
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
