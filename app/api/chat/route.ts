import { openai } from "@ai-sdk/openai";
import { ollama, createOllama } from 'ollama-ai-provider-v2';
import { streamText, UIMessage, convertToModelMessages } from "ai";


const customOllama = createOllama({
  baseURL: 'http://localhost:11434/api',
  // headers: {
  //   'Authorization': 'Bearer your-token',
  // },
});

export async function POST(req: Request) {
  const { messages, model }: { messages: UIMessage[]; model?: string } =
    await req.json();

  // Use provided model or fallback to default
  const selectedModel = model || "gemma3:latest";

  const result = streamText({
    model: ollama(selectedModel),
    system: "You are a helpful assistant.",
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
