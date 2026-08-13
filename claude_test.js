import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY not found. Add it to your .env file or export it in the terminal."
  );
}

const client = new Anthropic({ apiKey });
const prompt = process.argv.slice(2).join(" ") || "Write a one-sentence summary of Visual Studio Code.";

async function main() {
  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [
      { role: "user", content: prompt }
    ],
    max_tokens: 400,
  });

  console.log(message.content);
}

main().catch((error) => {
  console.error("Error:", error?.message ?? error);
  process.exit(1);
});
