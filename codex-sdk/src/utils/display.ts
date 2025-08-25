import type { UIMessage } from "./ai";

export type DisplayMessageType =
  | "toolCall"
  | "assistant"
  | "user"
  | "toolResponse"
  | "ui";

// Better role label mappings
export const roleLabels: Record<DisplayMessageType, string> = {
  user: "You",
  ui: "System",
  assistant: "AI",
  toolCall: "Command",
  toolResponse: "Result",
} as const;

/**
 * Determines the display message type for the new display configuration system
 * Replaces the old role-based system with proper content type detection
 */
export function getDisplayMessageType(message: UIMessage): DisplayMessageType {
  if (message.role === "user") {
    return "user";
  }
  if (message.role === "ui") {
    return "ui";
  }
  if (message.role === "tool") {
    return "toolResponse";
  }

  if (message.role === "assistant") {
    // Check if content is an array and contains any tool calls
    if (Array.isArray(message.content)) {
      const hasToolCall = message.content.some(
        (part) => part.type === "tool-call",
      );
      if (hasToolCall) {
        return "toolCall";
      }
    }
    return "assistant";
  }

  return "assistant"; // fallback
}

/**
 * Gets the display label for a message type
 */
export function getDisplayLabel(messageType: DisplayMessageType): string {
  return roleLabels[messageType] || messageType;
}
