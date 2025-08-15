import type { UIMessage } from "../../utils/ai.js";

export function normalizeToUiMessage(
  value: UIMessage | string,
): UIMessage {
  if (typeof value === "string") {
    return { role: "ui", content: value } as UIMessage;
  }
  return value;
}

export function filterTranscript(messages: Array<UIMessage>): Array<UIMessage> {
  return messages.filter((msg) => msg.role !== "ui");
}

export function flattenUserInputContent(
  parts: Array<string | { text?: string; content?: string } | unknown>,
): string {
  const hasStringProp = <K extends string>(obj: unknown, key: K): obj is Record<K, string> => {
    return typeof obj === "object" && obj != null && typeof (obj as Record<string, unknown>)[key] === "string";
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


