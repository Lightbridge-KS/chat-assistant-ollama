/**
 * Vision Image Adapter for assistant-ui
 *
 * Handles image attachments for vision-capable LLMs.
 * Converts uploaded images to base64 data URLs for Ollama API.
 */

import type {
  AttachmentAdapter,
  PendingAttachment,
  CompleteAttachment,
} from "@assistant-ui/react";

export class VisionImageAdapter implements AttachmentAdapter {
  accept = "image/jpeg,image/png,image/webp,image/gif";

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    // Validate file size (20MB limit - Ollama's typical limit)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      throw new Error("Image size exceeds 20MB limit");
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image");
    }

    return {
      id: crypto.randomUUID(),
      type: "image",
      name: file.name,
      contentType: file.type,
      file,
      status: {
        type: "running",
        reason: "uploading",
        progress: 0,
      },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    // Only process image attachments with files
    if (attachment.type !== "image" || !attachment.file) {
      throw new Error("Invalid attachment type for VisionImageAdapter");
    }

    // Convert File to base64 data URL
    const base64 = await this.fileToBase64DataURL(attachment.file);

    return {
      id: attachment.id,
      type: "image",
      name: attachment.name,
      contentType: attachment.contentType,
      content: [
        {
          type: "image",
          image: base64, // data:image/jpeg;base64,... format
        },
      ],
      status: { type: "complete" },
    };
  }

  async remove() {
    // No-op: cleanup handled by browser garbage collection
    // File URLs are revoked by the UI component
  }

  private fileToBase64DataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }
}
