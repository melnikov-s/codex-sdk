import type { FileAttachment } from "./file-tag-utils.js";
import type { ModelMessage, ImagePart, TextPart } from "ai";

import { fileTypeFromBuffer } from "file-type";
import fs from "fs/promises";
import path from "path";

export async function createInputItem(
  text: string,
  images: Array<string> = [],
  fileAttachments: Array<FileAttachment> = [],
): Promise<ModelMessage> {
  const inputItem: ModelMessage = {
    role: "user",
    content: [],
  };

  // Add the main text content
  if (text.trim()) {
    (inputItem.content as Array<TextPart>).push({
      type: "text",
      text,
    });
  }

  // Process file attachments from @ syntax
  for (const attachment of fileAttachments) {
    if (attachment.isText) {
      // For text files, include the content inline with file marker
      const rel = path.relative(process.cwd(), attachment.resolvedPath);
      const content = attachment.content.toString("utf-8");
      (inputItem.content as Array<TextPart>).push({
        type: "text",
        text: `\n<${rel}>\n${content}\n</${rel}>\n`,
      });
    } else if (attachment.mimeType?.startsWith("image/")) {
      // For images, include as base64
      const encoded = attachment.content.toString("base64");
      (inputItem.content as Array<ImagePart>).push({
        type: "image",
        mediaType: attachment.mimeType,
        image: `data:${attachment.mimeType};base64,${encoded}`,
      });
    } else if (
      attachment.mimeType === "application/pdf" ||
      attachment.mimeType === "application/msword" ||
      attachment.mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      (attachment.mimeType?.startsWith("application/") &&
        attachment.content.length < 10 * 1024 * 1024) // 10MB limit
    ) {
      // For supported document types, include as base64 with size limit
      const encoded = attachment.content.toString("base64");
      const fileName = path.basename(attachment.resolvedPath);

      (inputItem.content as Array<TextPart>).push({
        type: "text",
        text: `[document: ${fileName}]\ndata:${attachment.mimeType};base64,${encoded}\n[/document]`,
      });
    } else {
      // For other binary files, we could potentially support more types
      // For now, include a reference with the file info
      const fileName = path.basename(attachment.resolvedPath);
      const fileSize = attachment.content.length;
      const fileSizeKB = Math.round(fileSize / 1024);

      (inputItem.content as Array<TextPart>).push({
        type: "text",
        text: `[file: ${fileName} (${attachment.mimeType || "unknown type"}, ${fileSizeKB}KB)]`,
      });
    }
  }

  // Process legacy image paths (for backwards compatibility)
  for (const filePath of images) {
    try {
      const binary = await fs.readFile(filePath);
      const kind = await fileTypeFromBuffer(binary);
      const encoded = binary.toString("base64");
      const mime = kind?.mime ?? "application/octet-stream";
      (inputItem.content as Array<ImagePart>).push({
        type: "image",
        mediaType: mime,
        image: `data:${mime};base64,${encoded}`,
      });
    } catch (err) {
      (inputItem.content as Array<TextPart>).push({
        type: "text",
        text: `[missing image: ${path.basename(filePath)}]`,
      });
    }
  }

  return inputItem;
}
