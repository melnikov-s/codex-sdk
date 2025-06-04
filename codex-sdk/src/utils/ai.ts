import type { Model } from "./providers";

import { generateId, type CoreMessage } from "ai";

const idMap = new WeakMap<UIMessage, string>();

export function getId(message: UIMessage): string {
  if (!idMap.has(message)) {
    idMap.set(message, generateId());
  }
  return idMap.get(message)!;
}

export function isNativeTool(toolName: string | undefined) {
  return toolName === "shell" || toolName === "apply_patch";
}

export type UIMessage =
  | {
      role: "ui";
      content: string;
    }
  | CoreMessage;

export type MessageType =
  | "message"
  | "function_call"
  | "function_call_output"
  | "reasoning"
  | "mcp_call"
  | "mcp_output"
  | "ui";

export function getMessageType(item: UIMessage): MessageType {
  if (item.role === "user") {
    return "message";
  }
  if (
    item.role === "assistant" &&
    Array.isArray(item.content) &&
    item.content.find((part) => part.type === "tool-call")
  ) {
    const toolCall = item.content.find((part) => part.type === "tool-call");
    if (isNativeTool(toolCall?.toolName)) {
      return "function_call";
    }
    return "mcp_call";
  }
  if (
    item.role === "assistant" &&
    Array.isArray(item.content) &&
    item.content.find((part) => part.type === "reasoning")
  ) {
    return "reasoning";
  }

  if (item.role === "tool") {
    const result = item.content.find((part) => part.type === "tool-result");
    if (isNativeTool(result?.toolName)) {
      return "function_call_output";
    }

    return "mcp_output";
  }

  if (item.role === "ui") {
    return "ui";
  }

  return "message";
}

export function getReasoning(item: UIMessage) {
  const type = getMessageType(item);
  if (type === "reasoning") {
    const part = Array.isArray(item.content)
      ? item.content.find((part) => part.type === "reasoning")
      : null;
    return part?.text ?? null;
  }
  return null;
}

export function getToolCall(message: UIMessage) {
  if (message.role === "assistant" && Array.isArray(message.content)) {
    return message.content.find((part) => part.type === "tool-call") ?? null;
  }
  return null;
}

export function getToolCallResult(message: UIMessage) {
  if (message.role === "tool" && Array.isArray(message.content)) {
    const resultPart = message.content.find(
      (part) => part.type === "tool-result",
    );
    return resultPart ?? null;
  }
  return null;
}

export function getTextContent(message: UIMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");
  }

  return "";
}

const contextSize: { [key in Model]: number } = {
  "anthropic/claude-3-5-haiku-20241022": 200000,
  "anthropic/claude-3-5-sonnet-20241022": 200000,
  "anthropic/claude-3-7-sonnet-20250219": 200000,
  "deepseek/deepseek-chat": 32768,
  "deepseek/deepseek-reasoner": 128000,
  "google/gemini-2.0-flash": 1000000,
  "google/gemini-2.0-flash-exp": 1000000,
  "google/gemini-2.5-flash-preview-04-17": 1000000,
  "google/gemini-2.5-pro-latest": 1000000,
  "google/gemini-2.5-pro-preview-05-06": 1000000,
  "openai/gpt-3.5-turbo": 16385,
  "openai/gpt-4o": 128000,
  "openai/gpt-4o-mini": 128000,
  "openai/o1": 16385,
  "openai/o1-mini": 16385,
  "openai/o1-preview": 16385,
  "openai/o3": 16385,
  "openai/o3-mini": 16385,
  "openai/o4-mini": 128000,
};

export function calculateContextPercentRemaining(
  items: Array<UIMessage>,
  model: string,
): number {
  const totalContentLength = items.reduce(
    (sum, item) => sum + getTextContent(item).length,
    0,
  );
  const modelKey = model as Model;
  let maxContext = contextSize[modelKey];
  if (maxContext === undefined) {
    const foundKey = (Object.keys(contextSize) as Array<Model>).find((key) =>
      model.includes(key),
    );
    if (foundKey) {
      maxContext = contextSize[foundKey];
    }
  }
  if (maxContext === undefined) {
    return 100;
  }
  const usedPercent = (totalContentLength / maxContext) * 100;
  const remainingPercent = Math.max(0, 100 - usedPercent);
  return remainingPercent;
}

export function getAvailableModels(): Array<Model> {
  return [
    "anthropic/claude-3-5-haiku-20241022",
    "anthropic/claude-3-5-sonnet-20241022",
    "anthropic/claude-3-7-sonnet-20250219",
    "deepseek/deepseek-chat",
    "deepseek/deepseek-reasoner",
    "google/gemini-2.0-flash",
    "google/gemini-2.0-flash-exp",
    "google/gemini-2.5-flash-preview-04-17",
    "google/gemini-2.5-pro-latest",
    "google/gemini-2.5-pro-preview-05-06",
    "openai/gpt-3.5-turbo",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/o1",
    "openai/o1-mini",
    "openai/o1-preview",
    "openai/o3",
    "openai/o3-mini",
    "openai/o4-mini",
  ];
}
