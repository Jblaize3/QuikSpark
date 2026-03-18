import MatchmakingService from './matchmaking-service.js';
import dotenv from 'dotenv';

dotenv.config();

const technicalFounder = {
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
};

const businessFounder = {
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
};

async function runTests() {
    console.log("🚀 QuikSpark AI Matchmaking Test\n");
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error("❌ Error: ANTHROPIC_API_KEY not found");
        process.exit(1);
    }

    const matchmaker = new MatchmakingService(apiKey);

    console.log("📊 Testing: Technical Founder + Business Founder\n");
    try {
        const match = await matchmaker.matchUsers(technicalFounder, businessFounder);
        console.log(`✅ Compatibility Score: ${match.compatibilityScore}/100`);
        console.log(`📈 Match Strength: ${match.matchStrength}`);
        console.log(`\n💡 ${match.reasoning}`);
        console.log(`\n🤝 Shared: ${match.sharedInterests.join(', ')}`);
        console.log(`⚡ Skills: ${match.complementarySkills.join(', ')}`);
        console.log(`\n🎯 Next: ${match.recommendedNextSteps}`);
    } catch (error) {
        console.error("❌ Failed:", error.message);
    }
}

runTests();
