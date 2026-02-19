import { Injectable } from "@nestjs/common";
import { AppLogger } from "../../utils/logger";
import type { Attachment, UserContentPart } from "./chat.types";

async function parsePdf(data: Buffer): Promise<{ text: string }> {
  const mod = await import("pdf-parse");
  const fn = (mod.default ?? mod) as unknown as (
    buf: Buffer,
  ) => Promise<{ text: string }>;
  return fn(data);
}

@Injectable()
export class AttachmentProcessorService {
  /**
   * Build multimodal user content parts from raw text + attachments.
   */
  async buildUserContent(
    rawText: string,
    attachments?: Attachment[],
  ): Promise<UserContentPart[]> {
    const contentParts: UserContentPart[] = [{ type: "text", text: rawText }];

    if (!attachments || attachments.length === 0) {
      return contentParts;
    }

    for (const att of attachments) {
      if (att.type === "image" && att.base64) {
        contentParts.push({
          type: "image",
          image: `data:${att.mimeType || "image/jpeg"};base64,${att.base64}`,
          providerOptions: { openai: { imageDetail: "low" } },
        });
        continue;
      }

      if (att.type !== "file") {
        continue;
      }

      // PDF attachments
      if (att.mimeType === "application/pdf" && att.base64) {
        try {
          const buffer = Buffer.from(att.base64, "base64");
          const data = await parsePdf(buffer);
          contentParts.push({
            type: "text",
            text: `\n[Document Content: ${att.name}]\n${data.text}\n[End Document Content]\n`,
          });
        } catch (error) {
          AppLogger.error(`Failed to parse PDF ${att.name}`, error);
          contentParts.push({
            type: "text",
            text: `\n[System: Failed to parse PDF ${att.name}]\n`,
          });
        }
        continue;
      }

      // Text-based files
      if (att.base64) {
        try {
          const text = Buffer.from(att.base64, "base64").toString("utf-8");
          contentParts.push({
            type: "text",
            text: `\n[File Content: ${att.name}]\n${text}\n[End File Content]\n`,
          });
        } catch (error) {
          AppLogger.error(`Failed to decode text file ${att.name}`, error);
        }
      }
    }

    return contentParts;
  }
}
