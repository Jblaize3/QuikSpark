import Anthropic from "@anthropic-ai/sdk";

class MatchmakingService {
    constructor(apiKey) {
        this.client = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY
        });
    }

    async matchUsers(user1, user2) {
        const prompt = this.buildMatchingPrompt(user1, user2);

        try {
            const message = await this.client.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1500,
                messages: [{
                    role: "user",
                    content: prompt
                }]
            });

            const response = message.content[0].text;
            return this.parseMatchingResponse(response, user1, user2);
        } catch (error) {
            console.error("Matching error:", error);
            throw new Error("Failed to generate match analysis");
        }
    }

    async findTopMatches(user, candidates, topN = 5) {
        const matches = [];

        for (const candidate of candidates) {
            try {
                const matchResult = await this.matchUsers(user, candidate);
                matches.push({
                    candidate: candidate,
                    ...matchResult
                });
            } catch (error) {
                console.error(`Failed to match with ${candidate.email}:`, error);
            }
        }

        matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
        return matches.slice(0, topN);
    }

    buildMatchingPrompt(user1, user2) {
        return `You are an expert matchmaker for QuikSpark, a platform connecting entrepreneurs and creators to build businesses together.

Analyze these two profiles and determine their compatibility as potential co-founders or collaborators.

User 1:
Name: ${user1.firstName} ${user1.lastName}
Email: ${user1.email}
Role: ${user1.role || 'Entrepreneur'}
Skills: ${user1.skills?.join(', ') || 'Not specified'}
Interests: ${user1.interests?.join(', ') || 'Not specified'}
Looking for: ${user1.lookingFor || 'Not specified'}
Goals: ${user1.goals || 'Not specified'}
Experience: ${user1.experience || 'Not specified'}
Working style: ${user1.workingStyle || 'Not specified'}
Availability: ${user1.availability || 'Not specified'}

User 2:
Name: ${user2.firstName} ${user2.lastName}
Email: ${user2.email}
Role: ${user2.role || 'Entrepreneur'}
Skills: ${user2.skills?.join(', ') || 'Not specified'}
Interests: ${user2.interests?.join(', ') || 'Not specified'}
Looking for: ${user2.lookingFor || 'Not specified'}
Goals: ${user2.goals || 'Not specified'}
Experience: ${user2.experience || 'Not specified'}
Working style: ${user2.workingStyle || 'Not specified'}
Availability: ${user2.availability || 'Not specified'}

Analyze their compatibility and respond in this EXACT JSON format:
{
    "compatibilityScore": 0-100,
    "matchStrength": "Excellent|Strong|Good|Fair|Poor",
    "reasoning": "2-3 sentence explanation of why they're compatible or not",
    "sharedInterests": ["list", "of", "overlap"],
    "complementarySkills": ["how", "skills", "complement"],
    "potentialChallenges": ["potential", "conflicts"],
    "recommendedNextSteps": "what they should do if they connect"
}

Be honest and specific. Focus on real compatibility factors.`;
    }

    parseMatchingResponse(response, user1, user2) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON found in response");
            }

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                user1Id: user1.email,
                user2Id: user2.email,
                compatibilityScore: parsed.compatibilityScore,
                matchStrength: parsed.matchStrength,
                reasoning: parsed.reasoning,
                sharedInterests: parsed.sharedInterests || [],
                complementarySkills: parsed.complementarySkills || [],
                potentialChallenges: parsed.potentialChallenges || [],
                recommendedNextSteps: parsed.recommendedNextSteps,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error("Parse error:", error);
            throw new Error("Failed to parse matching response");
        }
    }
}

export default MatchmakingService;
