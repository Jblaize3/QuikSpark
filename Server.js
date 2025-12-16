import express from "express";
import cors from "cors";

// --- START: Uncaught Exception Handler ---
process.on('uncaughtException', function (err) {
    console.error('Caught exception:', err.stack);
    // Prevents the application from completely crashing immediately,
    // allowing the error log to be fully sent to Render logs.
    process.exit(1); 
});
// --- END: Uncaught Exception Handler ---


const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("🔥 QuikSpark backend is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));