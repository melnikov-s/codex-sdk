/* eslint-disable react-refresh/only-export-components */
// Simple export API for custom workflow integration

// Export the core workflow types and interfaces
export {
  Workflow,
  WorkflowHooks,
  WorkflowFactory,
  WorkflowState,
  createAgentWorkflow,
} from "./workflow/index.js";
export { createDefaultWorkflow } from "./workflow/default-agent.js";

// Re-export approval mode constants for use by consumers
export { AutoApprovalMode } from "./utils/auto-approval-mode.js";

// Export approval types for use by consumers
export type { ApprovalPolicy, SafetyAssessment } from "./approvals.js";

// Import necessary components
import type { ApprovalPolicy } from "./approvals.js";
import type { FullAutoErrorMode } from "./utils/auto-approval-mode.js";
import type { WorkflowFactory } from "./workflow/index.js";

import App from "./app.js";
import { AutoApprovalMode } from "./utils/auto-approval-mode.js";
import { onExit, setInkRenderer } from "./utils/terminal.js";
import { render } from "ink";
import React from "react";

export interface HeaderConfig {
  label: string;
  value: string;
}

/**
 * Minimal configuration required for the UI and tools
 * Excludes LLM configuration which is handled by the consumer's workflow
 */
export interface LibraryConfig {
  /** Whether to show desktop notifications */
  notify?: boolean;
  /** Tool-specific configuration */
  tools?: {
    shell?: {
      maxBytes?: number;
      maxLines?: number;
    };
  };
  /** Auto error mode for unsandboxed commands */
  fullAutoErrorMode?: FullAutoErrorMode;
  /** Additional headers to display in the terminal */
  headers?: Array<HeaderConfig> | (() => Array<HeaderConfig>);
  /** Custom status line to display below the header */
  statusLine?: string | (() => string);
}

/**
 * Options for running the CLI with a custom workflow
 */
export interface CliOptions {
  /** User prompt (optional, defaults to command line args if not provided) */
  prompt?: string;
  /**
   * Approval policy for commands (optional, defaults to "suggest")
   * Controls how tool executions are approved in the UI
   */
  approvalPolicy?: ApprovalPolicy;
  /** Additional directories to allow file system access to (optional) */
  additionalWritableRoots?: ReadonlyArray<string>;
  /** Whether to display full subprocess stdout (optional) */
  fullStdout?: boolean;
  /** Paths to images to include with the prompt (optional) */
  imagePaths?: Array<string>;
  /**
   * UI and tool configuration (optional)
   * Does NOT include LLM settings which are handled by workflow
   */
  config?: LibraryConfig;
}

/**
 * Run the CLI with a custom workflow factory
 *
 * The library handles the UI and common tools, while your custom workflow
 * implements the agent logic and LLM interactions.
 *
 * @param workflowFactory The factory function to create your custom workflow
 * @param options Optional configuration for the CLI
 */
export function run(
  workflowFactory: WorkflowFactory,
  options: CliOptions = {},
) {
  // Use provided prompt or get from command line arguments

  // Create minimal UI config
  const uiConfig = options.config || {};

  // Render the App with the custom workflow
  // LLM behavior is handled by the consumer's workflow
  const inkInstance = render(
    <App
      uiConfig={uiConfig}
      approvalPolicy={options.approvalPolicy || AutoApprovalMode.SUGGEST}
      additionalWritableRoots={options.additionalWritableRoots || []}
      fullStdout={options.fullStdout || false}
      workflowFactory={workflowFactory}
    />,
  );
  setInkRenderer(inkInstance);

  // --- Signal handling for graceful exit ---
  const handleProcessExit = () => {
    onExit(); // This will attempt to unmount Ink
    process.exit(0);
  };

  process.on("SIGINT", handleProcessExit);
  process.on("SIGQUIT", handleProcessExit);
  process.on("SIGTERM", handleProcessExit);

  // Fallback for Ctrl-C when stdin is in raw-mode (which Ink uses)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true); // Ensure raw mode is explicitly set if not already
    const onRawData = (data: Buffer | string): void => {
      const str = Buffer.isBuffer(data)
        ? data.toString("utf8")
        : data.toString();
      if (str === "\u0003") {
        // ETX, Ctrl+C
        handleProcessExit();
      }
    };
    process.stdin.on("data", onRawData);
    // Ensure stdin cleanup on exit
    process.on("exit", () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onRawData);
      }
    });
  }

  // Ensure terminal clean-up always runs, even when other code calls
  // `process.exit()` directly. This is a safety net.
  process.once("exit", onExit);
  return inkInstance;
}
