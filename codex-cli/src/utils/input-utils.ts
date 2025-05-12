import type { CoreUserMessage, ImagePart, TextPart } from "ai";

import { fileTypeFromBuffer } from "file-type";
import fs from "fs/promises";
import path from "path";

export async function createInputItem(
  text: string,
  images: Array<string>,
): Promise<CoreUserMessage> {
  const inputItem: CoreUserMessage = {
    role: "user",
    content: [{ type: "text", text }],
  };

  for (const filePath of images) {
    try {
      const binary = await fs.readFile(filePath);
      const kind = await fileTypeFromBuffer(binary);
      const encoded = binary.toString("base64");
      const mime = kind?.mime ?? "application/octet-stream";
      (inputItem.content as Array<ImagePart>).push({
        type: "image",
        mimeType: mime,
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
