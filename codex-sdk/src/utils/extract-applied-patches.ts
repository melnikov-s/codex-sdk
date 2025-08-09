import type { ModelMessage } from "ai";

import { getMessageType } from "./ai";

/**
 * Extracts the patch texts of all `apply_patch` tool calls from the given
 * message history. Returns an empty string when none are found.
 */
export function extractAppliedPatches(items: Array<ModelMessage>): string {
  const patches: Array<string> = [];

  for (const item of items) {
    if (getMessageType(item) !== "function_call") {
      continue;
    }

    const { name: toolName, arguments: argsString } = item as unknown as {
      name: unknown;
      arguments: unknown;
    };

    if (toolName !== "apply_patch" || typeof argsString !== "string") {
      continue;
    }

    try {
      const args = JSON.parse(argsString) as { patch?: string };
      if (typeof args.patch === "string" && args.patch.length > 0) {
        patches.push(args.patch.trim());
      }
    } catch {
      // Ignore malformed JSON – we never want to crash the overlay.
      continue;
    }
  }

  return patches.join("\n\n");
}
