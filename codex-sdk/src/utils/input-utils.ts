import type { FileAttachment } from "./file-tag-utils.js";
import type { CoreUserMessage, ImagePart, TextPart } from "ai";

import { fileTypeFromBuffer } from "file-type";
import fs from "fs/promises";
import path from "path";

export async function createInputItem(
  text: string,
  images: Array<string> = [],
  fileAttachments: Array<FileAttachment> = [],
): Promise<CoreUserMessage> {
  const inputItem: CoreUserMessage = {
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
    } else {
      // For other binary files, include a reference
      (inputItem.content as Array<TextPart>).push({
        type: "text",
        text: `[binary file: ${path.basename(attachment.resolvedPath)} (${attachment.mimeType || "unknown type"})]`,
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
