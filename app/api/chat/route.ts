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
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: ollama("gemma3:latest"),
    system: "You are a helpful assistant.",
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
