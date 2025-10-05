import type { UIMessage } from "../../utils/ai.js";
import type { ModelMessage, TextPart, ToolCallPart } from "ai";

export function normalizeToUiMessage(value: UIMessage | string): UIMessage {
  if (typeof value === "string") {
    return { role: "ui", content: value } as UIMessage;
  }
  return value;
}

export function filterTranscript(
  messages: Array<UIMessage>,
): Array<ModelMessage> {
  // Exclude UI-only messages and strip reasoning parts from assistant content.
  // Some providers require that prior messages do not include reasoning items.
  const sanitized: Array<ModelMessage> = [];
  for (const msg of messages) {
    if (msg.role === "ui") {
      continue;
    }

    if (msg.role === "assistant") {
      const original = msg as Extract<ModelMessage, { role: "assistant" }>;
      if (Array.isArray(original.content)) {
        type AllowedAssistantPart = TextPart | ToolCallPart;
        const filteredParts = (original.content as Array<
          AllowedAssistantPart | { type?: string }
        >).filter((part) => {
          const t = (part as { type?: string } | undefined)?.type;
          return t !== "reasoning";
        }) as Array<AllowedAssistantPart>;
        if (filteredParts.length === 0) {
          // Drop assistant messages that would be empty after removing reasoning parts
          continue;
        }
        const sanitizedAssistant: Extract<ModelMessage, { role: "assistant" }> = {
          ...original,
          content: filteredParts,
        };
        sanitized.push(sanitizedAssistant);
        continue;
      }
    }

    sanitized.push(msg as ModelMessage);
  }
  return sanitized;
}

export function flattenUserInputContent(
  parts: Array<string | { text?: string; content?: string } | unknown>,
): string {
  const hasStringProp = <K extends string>(
    obj: unknown,
    key: K,
  ): obj is Record<K, string> => {
    return (
      typeof obj === "object" &&
      obj != null &&
      typeof (obj as Record<string, unknown>)[key] === "string"
    );
  };

  return parts
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (hasStringProp(item, "text")) {
        return item.text;
      }
      if (hasStringProp(item, "content")) {
        return item.content;
      }
      return String(item);
    })
    .join("");
}
