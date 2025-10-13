/**
 * Ollama Runtime Adapter for assistant-ui
 *
 * Creates a custom runtime that uses ollama/browser directly for a static SPA.
 */

import { useLocalRuntime } from "@assistant-ui/react";
import type { ChatModelAdapter } from "@assistant-ui/react";
import { ollamaClient } from "./ollama-client";
import { useModelStore } from "./stores/model-store";

// Type for text content items
type TextContent = {
  type: "text";
  text: string;
};

export function useOllamaRuntime() {
  const adapter: ChatModelAdapter = {
    async *run({ messages, abortSignal }) {
      // Get current model from Zustand store
      const model = useModelStore.getState().selectedModel || "gemma3:latest";

      // Convert messages to Ollama format
      const ollamaMessages = messages.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content:
          msg.content
            .filter((c): c is TextContent => c.type === "text")
            .map((c) => c.text)
            .join("") || "",
      }));

      try {
        // Accumulate text from streaming response
        let accumulatedText = "";

        // Stream chat from Ollama
        const response = await ollamaClient.chat({
          model,
          messages: ollamaMessages,
          stream: true,
        });

        // Stream chunks and accumulate
        for await (const chunk of response) {
          // Check if aborted
          if (abortSignal?.aborted) {
            break;
          }

          const delta = chunk.message.content;
          accumulatedText += delta;

          // Yield accumulated content as TextMessagePart
          yield {
            content: [
              {
                type: "text" as const,
                text: accumulatedText,
              },
            ],
          };
        }
      } catch (error) {
        console.error("Ollama runtime error:", error);

        // Yield error status
        yield {
          content: [
            {
              type: "text" as const,
              text: "",
            },
          ],
          status: {
            type: "incomplete" as const,
            reason: "error" as const,
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  };

  return useLocalRuntime(adapter);
}
