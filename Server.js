import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mailchimp from "@mailchimp/mailchimp_marketing";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Mailchimp
const mcKey = process.env.MAILCHIMP_API_KEY;
const serverPrefix = mcKey?.split("-").pop();

mailchimp.setConfig({
  apiKey: mcKey,
  server: serverPrefix
});

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

// Early Access Form Submission Endpoint
app.post("/api/early-access", async (req, res) => {
    try {
        const { firstName, lastName, email, interests } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required fields" 
            });
        }

        // Add member to Mailchimp audience
        const response = await mailchimp.lists.addListMember("78887fb73a", {
            email_address: email,
            status: "subscribed",
            merge_fields: {
                FNAME: firstName,
                LNAME: lastName
            },
            tags: interests || []
        });

        console.log("Successfully added contact:", email);
        
        res.json({ 
            success: true, 
            message: "Successfully subscribed to early access!" 
        });

    } catch (error) {
        console.error("Mailchimp Error:", error.response?.body || error.message);
        
        // Handle duplicate email
        if (error.status === 400 && error.response?.body?.title === "Member Exists") {
            return res.status(400).json({ 
                success: false, 
                message: "This email is already registered for early access!" 
            });
        }

        res.status(500).json({ 
            success: false, 
            message: "Failed to subscribe. Please try again later." 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
