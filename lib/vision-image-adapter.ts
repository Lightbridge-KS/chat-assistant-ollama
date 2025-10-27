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
      id: this.generateUUID(),
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

  /**
   * Generate UUID with fallback for insecure contexts
   *
   * crypto.randomUUID() requires secure context (HTTPS or localhost).
   * Hospital deployment uses HTTP on local IP, so we need a fallback.
   */
  private generateUUID(): string {
    // Try crypto.randomUUID() first (works in HTTPS and localhost)
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback: Generate RFC4122 version 4 UUID manually
    // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
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
