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

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Mailchimp
const mcKey = process.env.MAILCHIMP_API_KEY;
mailchimp.setConfig({
    apiKey: mcKey,
    server: mcKey?.split("-").pop()
});

// --- START: Uncaught Exception Handler ---
process.on('uncaughtException', function (err) {
    console.error('Caught exception:', err.stack);
    process.exit(1);
});
// --- END: Uncaught Exception Handler ---

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

// Serve static files from public directory
app.use(express.static(path.join(__dirn