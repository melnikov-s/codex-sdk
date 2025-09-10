import type { ModelMessage } from "ai";

/**
 * Represents a grouped sequence of response items (e.g., function call batches).
 */
export type GroupedResponseItem = {
  label: string;
  items: Array<ModelMessage>;
};
