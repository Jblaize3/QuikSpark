import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const prompt = process.argv.slice(2).join(" ") || "Hello from terminal";

const message = await client.messages.create({
  model: "claude-3-5-sonnet-20241022",
  messages: [{ role: "user", content: prompt }],
  max_tokens: 400,
});

console.log(message.content);
