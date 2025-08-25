export type FullAutoErrorMode =
  | "continue"
  /**
   * Bail out of full-auto if the command fails.  Default.
   */
  | "halt";

export enum AutoApprovalMode {
  SUGGEST = "suggest",
  AUTO_EDIT = "auto-edit",
  FULL_AUTO = "full-auto",
}

export type ApprovalPolicy = AutoApprovalMode;

// Default shell output limits
export const DEFAULT_SHELL_MAX_BYTES = 1024 * 10; // 10 KB
export const DEFAULT_SHELL_MAX_LINES = 256;
