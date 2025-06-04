import type { ApplyPatchCommand } from "../../approvals.js";

export enum ReviewDecision {
  YES = "yes",
  NO_CONTINUE = "no-continue",
  NO_EXIT = "no-exit",
  /**
   * User has approved this command and wants to automatically approve any
   * future identical instances for the remainder of the session.
   */
  ALWAYS = "always",
  /**
   * User wants an explanation of what the command does before deciding.
   */
  EXPLAIN = "explain",
}

/**
 * Represents the result of command confirmation, indicating how to proceed
 * with command execution.
 */
export type CommandConfirmation = {
  review: ReviewDecision;
  applyPatch?: ApplyPatchCommand | undefined;
  customDenyMessage?: string;
  explanation?: string;
};
