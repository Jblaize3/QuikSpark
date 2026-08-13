import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import readline from "readline/promises";
import { stdin, stdout } from "process";

dotenv.config();

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error(
    "ANTHROPIC_API_KEY is not set. Add it to your .env file or export it before running the script."
  );
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const rl = readline.createInterface({ input: stdin, output: stdout });
const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929";
const conversation = [];

console.log(`Claude terminal chat using model ${model}. Type 'exit' or press Ctrl+C to quit.`);

async function main() {
  while (true) {
    const prompt = await rl.question("You: ");
    if (!prompt || prompt.trim().toLowerCase() === "exit") {
      break;
    }

    conversation.push({ role: "user", content: prompt });

    try {
      const message = await client.messages.create({
        model,
        messages: conversation,
        max_tokens: 600,
      });

      console.log("Claude:", message.content);
      conversation.push({ role: "assistant", content: message.content });
    } catch (error) {
      console.error("Error:", error?.message ?? error);
      break;
    }
  }

  rl.close();
}

main();
