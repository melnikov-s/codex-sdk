import type { UIMessage } from "./ai.js";

export type WorkflowInput = UIMessage | { role: string; content: unknown };

export function transformUserInput(input: WorkflowInput): WorkflowInput {
  if (
    (input as UIMessage)?.role === "user" &&
    Array.isArray((input as UIMessage).content)
  ) {
    const joined = ((input as UIMessage).content as Array<unknown>)
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (typeof item === "object" && item != null && "text" in (item as Record<string, unknown>)) {
          return (item as { text: string }).text;
        }
        if (typeof item === "object" && item != null && "content" in (item as Record<string, unknown>)) {
          return (item as { content: string }).content;
        }
        return String(item);
      })
      .join("");
    return { role: "user", content: joined } as WorkflowInput;
  }
  return input;
}


