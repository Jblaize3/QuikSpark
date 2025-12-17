import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- START: Uncaught Exception Handler ---
process.on('uncaughtException', function (err) {
    console.error('Caught exception:', err.stack);
    process.exit(1); 
});
// --- END: Uncaught Exception Handler ---

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for root route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API health check endpoint
app.get("/api/health", (req, res) => {
    res.json({ status: "🔥 QuikSpark backend is running!", timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));