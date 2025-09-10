import type { ModelMessage } from "ai";

/**
 * Roughly estimate the number of language‑model tokens represented by a list
 * of model messages.
 *
 * A full tokenizer would be more accurate, but would add a heavyweight
 * dependency for only marginal benefit. Empirically, assuming ~4 characters
 * per token offers a good enough signal for displaying context‑window usage
 * to the user.
 *
 * The algorithm counts characters from the different content types we may
 * encounter and then converts that char count to tokens by dividing by four
 * and rounding up.
 */
export function approximateTokensUsed(items: Array<ModelMessage>): number {
  let charCount = 0;

  for (const item of items) {
    charCount += item.content.length;
  }

  return Math.ceil(charCount / 4);
}
