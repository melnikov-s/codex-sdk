import { fileTypeFromBuffer } from "file-type";
import fs from "fs";
import path from "path";

export interface FileAttachment {
  path: string;
  resolvedPath: string;
  content: Buffer;
  isText: boolean;
  mimeType?: string;
}

export interface ProcessedInput {
  text: string;
  attachments: Array<FileAttachment>;
}

/**
 * Processes @path tokens in the input string, extracting files for attachment.
 * Handles both text and binary files appropriately.
 */
export async function processFileTokens(raw: string): Promise<ProcessedInput> {
  // Match @path patterns, supporting quotes for paths with spaces
  // Patterns: @'path with spaces', @"path with spaces", @unquoted_path
  const re = /@(?:'([^']*)'|"([^"]*)"|(\S+))/g;
  const attachments: Array<FileAttachment> = [];
  const placeholders = new Map<string, string>();

  type MatchInfo = {
    index: number;
    length: number;
    path: string;
    token: string;
  };
  const matches: Array<MatchInfo> = [];

  for (const m of raw.matchAll(re) as IterableIterator<RegExpMatchArray>) {
    const idx = m.index;
    // Extract the path from whichever capture group matched
    const captured = m[1] || m[2] || m[3]; // single quote, double quote, or unquoted
    if (idx !== undefined && captured) {
      matches.push({
        index: idx,
        length: m[0].length,
        path: captured.trim(), // Clean up whitespace
        token: m[0],
      });
    }
  }

  // Process each match
  for (const match of matches) {
    const resolved = path.resolve(process.cwd(), match.path);
    try {
      const st = fs.statSync(resolved);
      if (st.isFile()) {
        const content = fs.readFileSync(resolved);
        const fileType = await fileTypeFromBuffer(content);
        const isText = !fileType || isTextMimeType(fileType.mime);

        const attachment: FileAttachment = {
          path: match.path,
          resolvedPath: resolved,
          content,
          isText,
          mimeType: fileType?.mime,
        };

        attachments.push(attachment);

        // Create a placeholder that will be replaced in the text
        const placeholder = `[attached: ${path.basename(resolved)}]`;
        placeholders.set(match.token, placeholder);
      }
    } catch {
      // If path invalid, leave token as is
    }
  }

  // Replace tokens with placeholders
  let processedText = raw;
  for (const [token, placeholder] of placeholders) {
    processedText = processedText.replace(
      new RegExp(escapeRegex(token), "g"),
      placeholder,
    );
  }

  return { text: processedText, attachments };
}

/**
 * Helper to determine if a MIME type represents a text file
 */
function isTextMimeType(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript" ||
    mime === "application/typescript" ||
    mime.includes("xml") ||
    mime.includes("json")
  );
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Legacy function - now just extracts @file tokens without expanding
 * @deprecated Use processFileTokens instead
 */
export async function expandFileTags(raw: string): Promise<string> {
  const { text, attachments } = await processFileTokens(raw);

  // For backwards compatibility, include text file contents inline
  let result = text;
  for (const attachment of attachments) {
    if (attachment.isText) {
      const placeholder = `[attached: ${path.basename(attachment.resolvedPath)}]`;
      const rel = path.relative(process.cwd(), attachment.resolvedPath);
      const content = attachment.content.toString("utf-8");
      const xml = `<${rel}>\n${content}\n</${rel}>`;
      result = result.replace(placeholder, xml);
    }
  }

  return result;
}

/**
 * Collapses <path>content</path> XML blocks back to @path format.
 * This is the reverse operation of expandFileTags.
 * Only collapses blocks where the path points to a valid file; invalid paths remain unchanged.
 */
export function collapseXmlBlocks(text: string): string {
  return text.replace(
    /<([^\n>]+)>([\s\S]*?)<\/\1>/g,
    (match, path1: string) => {
      const filePath = path.normalize(path1.trim());

      try {
        // Only convert to @path format if it's a valid file
        return fs.statSync(path.resolve(process.cwd(), filePath)).isFile()
          ? "@" + filePath
          : match;
      } catch {
        return match; // Keep XML block if path is invalid
      }
    },
  );
}
