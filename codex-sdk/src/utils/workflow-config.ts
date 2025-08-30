import type { ApprovalPolicy } from "../approvals.js";
import type { UIMessage } from "./ai.js";
import type { FullAutoErrorMode } from "./auto-approval-mode.js";
import type { CustomizableHotkeyConfig } from "../hooks/use-customizable-hotkeys.js";
import type { WorkflowController } from "../workflow/index.js";
import type { InitialWorkflowRef } from "../workflow/multi-types.js";
import type React from "react";

export interface HeaderConfig {
  label: string;
  value: string;
}

/**
 * Configuration for workflow execution and tools
 */
export interface LibraryConfig {
  /** Tool-specific configuration */
  tools?: {
    shell?: {
      maxBytes?: number;
      maxLines?: number;
    };
  };
  /** User-defined safe commands that don't require approval */
  safeCommands?: Array<string>;
  /** Command history configuration */
  history?: {
    maxSize?: number;
    saveHistory?: boolean;
    sensitivePatterns?: Array<string>;
  };
  /** Auto error mode for unsandboxed commands */
  fullAutoErrorMode?: FullAutoErrorMode;
  /** Additional headers to display in the terminal */
  headers?: Array<HeaderConfig> | (() => Array<HeaderConfig>);
  /** Custom status line to display below the header */
  statusLine?: string | (() => string);
}

/**
 * Base options for running workflows
 */
interface BaseWorkflowOptions {
  /**
   * Approval policy for commands (optional, defaults to "suggest")
   * Controls how tool executions are approved in the UI
   */
  approvalPolicy?: ApprovalPolicy;
  /** Additional directories to allow file system access to (optional) */
  additionalWritableRoots?: ReadonlyArray<string>;
  /** Whether to display full subprocess stdout (optional) */
  fullStdout?: boolean;
  /**
   * UI and tool configuration (optional)
   * Does NOT include LLM settings which are handled by workflow
   */
  config?: LibraryConfig;
  /** Optional callback to receive controllers for programmatic control */
  onController?: (controller: WorkflowController) => void;
  /** Custom title for the multi-workflow environment */
  title?: React.ReactNode;
  /** Custom keyboard shortcut configuration (optional) */
  hotkeyConfig?: Partial<CustomizableHotkeyConfig>;
}

/**
 * Options for single workflow execution
 */
export interface SingleWorkflowOptions extends BaseWorkflowOptions {
  /** User prompt (optional, defaults to command line args if not provided) */
  prompt?: string;
  /** Paths to images to include with the prompt (optional) */
  imagePaths?: Array<string>;
  /** Run without Ink UI; executes the same workflow headlessly (single workflow only) */
  headless?: boolean;
  /** Headless-only pretty print customization */
  format?: {
    roleHeader?: (msg: UIMessage) => string;
    message?: (msg: UIMessage) => string;
  };
  /** Headless logging configuration */
  log?: { sink?: (line: string) => void; mode?: "human" | "jsonl" };
}

/**
 * Options for multi-workflow execution
 */
export interface MultiWorkflowOptions extends BaseWorkflowOptions {
  /**
   * Array of workflow instances to create on startup
   * If empty or not provided, starts with workflow selector
   */
  initialWorkflows?: Array<InitialWorkflowRef>;
}
