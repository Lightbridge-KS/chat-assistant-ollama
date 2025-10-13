/**
 * Ollama Runtime Adapter for assistant-ui
 *
 * Creates a custom runtime that uses ollama/browser directly for a static SPA.
 */

import { useLocalRuntime } from "@assistant-ui/react";
import type { ChatModelAdapter } from "@assistant-ui/react";
import { ollamaClient } from "./ollama-client";
import { useModelStore } from "./stores/model-store";
import { VisionImageAdapter } from "./vision-image-adapter";

// Type for message text content
type TextContent = {
  type: "text";
  text: string;
};

// Type for attachment image content
type AttachmentImageContent = {
  type: "image";
  image: string; // base64 data URL (will be stripped to raw base64 for Ollama)
};

// Type for message attachments
type MessageAttachment = {
  id: string;
  type: "image" | "file" | "document";
  name: string;
  contentType: string;
  content: AttachmentImageContent[];
  status: { type: string };
};

export function useOllamaRuntime() {
  const adapter: ChatModelAdapter = {
    async *run(runArgs) {
      // Debug: Log all parameters received
      // console.log("[Ollama Runtime] Run parameters:", Object.keys(runArgs));
      // console.log("[Ollama Runtime] Full run args:", runArgs);

      const { messages, abortSignal } = runArgs;

      // Get current model from Zustand store
      const model = useModelStore.getState().selectedModel || "gemma3:latest";

      // Convert messages to Ollama format
      const ollamaMessages = messages.map((msg) => {
        // Debug: Log raw message content
        console.log("[Ollama Runtime] Processing message:", {
          role: msg.role,
          contentItems: msg.content.length,
          contentTypes: msg.content.map((c) => c.type),
          fullContent: msg.content,
          allMessageKeys: Object.keys(msg),
          fullMessage: msg,
        });

        // Extract text content
        const textContent = msg.content
          .filter((c): c is TextContent => c.type === "text")
          .map((c) => c.text)
          .join("");

        // Extract image content from attachments (base64 only, without data URL prefix)
        const attachments = (msg.attachments || []) as MessageAttachment[];
        const imageContent = attachments
          .filter((att) => att.type === "image" && att.content)
          .flatMap((att) =>
            att.content
              .filter((c) => c.type === "image" && c.image)
              .map((c) => {
                // Strip data URL prefix (e.g., "data:image/jpeg;base64,")
                // Ollama expects just the base64 string, not the full data URL
                const base64Only = c.image.includes(",")
                  ? c.image.split(",")[1]
                  : c.image;

                // Debug logging
                console.log("[Ollama Runtime] Image detected:", {
                  attachmentId: att.id,
                  attachmentName: att.name,
                  hasDataPrefix: c.image.includes("data:"),
                  originalLength: c.image.length,
                  base64Length: base64Only.length,
                  base64Preview: base64Only.substring(0, 50) + "...",
                });

                return base64Only;
              })
          );

        // Build Ollama message
        const ollamaMsg: {
          role: string;
          content: string;
          images?: string[];
        } = {
          role: msg.role === "user" ? "user" : "assistant",
          content: textContent || "",
        };

        // Add images if present (for vision models)
        if (imageContent.length > 0) {
          ollamaMsg.images = imageContent;
        }

        return ollamaMsg;
      });

      // Prepend system message as first element
      const systemMessage = {
        role: "system",
        content: "You are a helpful assistance.",
      };

      const messagesWithSystem = [systemMessage, ...ollamaMessages];

      try {
        // Debug: Log what we're sending to Ollama
        console.log("[Ollama Runtime] Sending to Ollama:", {
          model,
          messageCount: messagesWithSystem.length,
          messagesWithImages: messagesWithSystem.filter((m) => (m as any).images?.length).length,
          lastMessage: {
            role: messagesWithSystem[messagesWithSystem.length - 1]?.role,
            contentLength: messagesWithSystem[messagesWithSystem.length - 1]?.content.length,
            imageCount: (messagesWithSystem[messagesWithSystem.length - 1] as any)?.images?.length || 0,
          },
        });

        // Accumulate text from streaming response
        let accumulatedText = "";

        // Stream chat from Ollama
        const response = await ollamaClient.chat({
          model,
          messages: messagesWithSystem,
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

  return useLocalRuntime(adapter, {
    adapters: {
      attachments: new VisionImageAdapter(),
    },
  });
}
