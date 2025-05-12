import type { Model } from "./providers";
import type { CoreMessage } from "ai";

import { getLanguageModel } from "./providers";
import { generateText } from 'ai';

/**
 * Generate a condensed summary of the conversation items.
 * @param items The list of conversation items to summarize
 * @param model The model to use for generating the summary
 * @param config The configuration object
 * @returns A concise structured summary string
 */
export async function generateCompactSummary(
  items: Array<CoreMessage>,
  model: Model,
): Promise<string> {
  const MAX_COMPACT_SUMMARY_TOKENS = 2048;

  const languageModel = getLanguageModel(model);

  const conversationText = items
    .filter(
      (
        item,
      ): item is CoreMessage & { content: Array<unknown>; role: string } =>
        (item.role === "user" || item.role === "assistant") &&
        Array.isArray(item.content),
    )
    .map((item) => {
      const text = item.content
        .filter(
          (part): part is { text: string } =>
            typeof part === "object" &&
            part != null &&
            "text" in part &&
            typeof (part as { text: unknown }).text === "string",
        )
        .map((part) => part.text)
        .join("");
      return `${item.role}: ${text}`;
    })
    .join("\n");

  const { text: summary } = await generateText({
    model: languageModel,
    messages: [
      {
        role: "assistant",
        content:
          "You are an expert coding assistant. Your goal is to generate a concise, structured summary of the conversation below that captures all essential information needed to continue development after context replacement. Include tasks performed, code areas modified or reviewed, key decisions or assumptions, test results or errors, and outstanding tasks or next steps.",
      },
      {
        role: "user",
        content: `Here is the conversation so far:\n${conversationText}\n\nPlease summarize this conversation, covering:\n1. Tasks performed and outcomes\n2. Code files, modules, or functions modified or examined\n3. Important decisions or assumptions made\n4. Errors encountered and test or build results\n5. Remaining tasks, open questions, or next steps\nProvide the summary in a clear, concise format.`,
      },
    ],
    maxTokens: MAX_COMPACT_SUMMARY_TOKENS,
  });
  return summary ?? "Unable to generate summary.";
}
