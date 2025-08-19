/* eslint-disable react-refresh/only-export-components */
// Simple export API for custom workflow integration

// Export the core workflow types and interfaces
export {
  Workflow,
  WorkflowHooks,
  WorkflowFactory,
  WorkflowState,
  WorkflowInitializer,
  MultiWorkflowController,
  WorkflowInfo,
  AttentionState,
  WorkflowEvent,
  WorkflowMetadata,
  createAgentWorkflow,
  createWorkflow,
  type WorkflowFactoryWithTitle,
} from "./workflow/index.js";

// Re-export approval mode constants for use by consumers
export { AutoApprovalMode } from "./utils/auto-approval-mode.js";
export { exit as exitSafely } from "./utils/terminal.js";

// Export approval types for use by consumers
export type { ApprovalPolicy, SafetyAssessment } from "./approvals.js";
export { getTextContent } from "./utils/ai.js";

// Import necessary components
import type { ApprovalPolicy } from "./approvals.js";
import type { UIMessage } from "./utils/ai.js";
import type { FullAutoErrorMode } from "./utils/auto-approval-mode.js";
import type { WorkflowController, WorkflowFactory, MultiWorkflowController, WorkflowFactoryWithTitle } from "./workflow/index.js";

import App from "./app.js";
import { runHeadless as runHeadlessInternal } from "./headless/index.js";
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
  /** Run without Ink UI; executes the same workflow headlessly */
  headless?: boolean;
  /** Optional callback to receive the controller for programmatic control (UI path) */
  onController?: (controller: WorkflowController) => void;
  /** Headless-only pretty print customization */
  format?: {
    roleHeader?: (msg: UIMessage) => string;
    message?: (msg: UIMessage) => string;
  };
  /** Headless logging configuration */
  log?: { sink?: (line: string) => void; mode?: "human" | "jsonl" };
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
): WorkflowController {
  if (options.headless) {
    // Headless branch: no Ink. Return controller directly.
    return runHeadlessInternal(workflowFactory, {
      approvalPolicy: options.approvalPolicy,
      additionalWritableRoots: options.additionalWritableRoots,
      fullStdout: options.fullStdout,
      config: options.config,
      format: options.format,
      log: options.log,
    });
  }

  // Use provided prompt or get from command line arguments

  // Create minimal UI config
  const uiConfig = options.config || {};

  // Render the App with the custom workflow
  // LLM behavior is handled by the consumer's workflow
  let controllerRef: WorkflowController | null = null;
  const inkInstance = render(
    <App
      uiConfig={uiConfig}
      approvalPolicy={options.approvalPolicy || AutoApprovalMode.SUGGEST}
      additionalWritableRoots={options.additionalWritableRoots || []}
      fullStdout={options.fullStdout || false}
      workflowFactory={workflowFactory}
      onController={(c) => {
        controllerRef = c;
        options.onController?.(c);
      }}
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

  // Handle Ctrl+C in raw mode (when SIGINT might not reach process handlers)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    const onRawData = (data: Buffer | string): void => {
      const str = Buffer.isBuffer(data) ? data.toString("utf8") : data.toString();
      if (str === "\u0003") {
        // ETX, Ctrl+C - exit immediately
        handleProcessExit();
      }
    };
    process.stdin.on("data", onRawData);
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

  // Return a stable controller proxy that delegates once available
  const proxy: WorkflowController = {
    headless: false,
    message: (input) => controllerRef?.message(input as unknown as string),
    stop: () => controllerRef?.stop(),
    terminate: (code?: number) => controllerRef?.terminate(code),
    getState: () =>
      controllerRef
        ? controllerRef.getState()
        : ({} as unknown as ReturnType<WorkflowController["getState"]>),
  };
  return proxy;
}

/**
 * Run the CLI with multiple workflows in a tabbed interface
 *
 * Launcher-first: accepts a catalog of workflow factories with static titles,
 * opens launcher on start (no instances created automatically).
 */
export function runMultiWorkflow(
  workflows: Array<WorkflowFactoryWithTitle>,
  options: CliOptions = {},
): MultiWorkflowController {
  if (options.headless) {
    const firstWorkflow = workflows[0];
    if (!firstWorkflow) {
      throw new Error("At least one workflow is required for multi-workflow mode");
    }
    const singleController = runHeadlessInternal(firstWorkflow, {
      approvalPolicy: options.approvalPolicy,
      additionalWritableRoots: options.additionalWritableRoots,
      fullStdout: options.fullStdout,
      config: options.config,
      format: options.format,
      log: options.log,
    });
    
    // Wrap in multi-workflow interface (minimal implementation for headless)
    const multiController: MultiWorkflowController = {
      ...singleController,
      slots: {
        set: () => { throw new Error("Manager slots not supported in headless mode"); },
        clear: () => { throw new Error("Manager slots not supported in headless mode"); },
        clearAll: () => { throw new Error("Manager slots not supported in headless mode"); },
      },
      createInstance: () => "main",
      removeInstance: () => { throw new Error("Not implemented in headless mode"); },
      switchToInstance: () => { throw new Error("Not implemented in headless mode"); },
      closeInstance: () => { throw new Error("Not implemented in headless mode"); },
      killInstance: () => { throw new Error("Not implemented in headless mode"); },
      listInstances: () => [{
        id: "main",
        title: firstWorkflow.title,
        status: 'idle',
        attention: { requiresInput: false, hasNotification: false, priority: 'medium', lastActivity: new Date() },
        isActive: true,
        createdAt: new Date(),
      }],
      getActiveInstance: () => "main",
      findInstance: () => "main",
      listAvailableWorkflows: () => workflows.map(f => ({ title: f.title, factory: f })),
      openLauncher: () => { throw new Error("Launcher not supported in headless mode"); },
      sendToWorkflow: (_id, message) => singleController.message(message),
      broadcastToAll: (message) => singleController.message(message),
      getWorkflowsRequiringAttention: () => [],
      switchToNextAttention: () => false,
      switchToNextNonLoading: () => false,
      switchToPreviousNonLoading: () => false,
      updateWorkflowAttention: () => {},
      updateWorkflowStatus: () => {},
      markAttentionHandled: () => {},
      onWorkflowEvent: () => () => {},
      offWorkflowEvent: () => {},
    };
    
    return multiController;
  }

  // Create minimal UI config
  const uiConfig = options.config || {};

  // Render the Enhanced App with multi-workflow support
  let controllerRef: MultiWorkflowController | null = null;
  const pendingManagerSlotOps: Array<(controller: MultiWorkflowController) => void> = [];
  const inkInstance = render(
    <App
      uiConfig={uiConfig}
      approvalPolicy={options.approvalPolicy || AutoApprovalMode.SUGGEST}
      additionalWritableRoots={options.additionalWritableRoots || []}
      fullStdout={options.fullStdout || false}
      multiWorkflow={true}
      availableWorkflows={workflows}
      onMultiController={(c) => {
        controllerRef = c;
        options.onController?.(c);
        // Apply any manager slot operations queued before controller was ready
        while (pendingManagerSlotOps.length > 0) {
          const op = pendingManagerSlotOps.shift();
          try {
            op?.(c);
          } catch {
            // ignore
          }
        }
      }}
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

  // Handle Ctrl+C in raw mode (when SIGINT might not reach process handlers)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    const onRawData = (data: Buffer | string): void => {
      const str = Buffer.isBuffer(data) ? data.toString("utf8") : data.toString();
      if (str === "\u0003") {
        // ETX, Ctrl+C - exit immediately
        handleProcessExit();
      }
    };
    process.stdin.on("data", onRawData);
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

  // Return a stable controller proxy that delegates once available
  const proxy: MultiWorkflowController = {
    headless: false,
    message: (input) => controllerRef?.message(input as unknown as string),
    stop: () => controllerRef?.stop(),
    terminate: (code?: number) => controllerRef?.terminate(code),
    getState: () =>
      controllerRef
        ? controllerRef.getState()
        : ({} as unknown as ReturnType<MultiWorkflowController["getState"]>),
    
    // Manager slots
    slots: {
      set: (region, content) => {
        if (controllerRef?.slots) {
          return controllerRef.slots.set(region, content);
        }
        pendingManagerSlotOps.push((ctrl: MultiWorkflowController) => ctrl.slots.set(region, content));
      },
      clear: (region) => {
        if (controllerRef?.slots) {
          return controllerRef.slots.clear(region);
        }
        pendingManagerSlotOps.push((ctrl: MultiWorkflowController) => ctrl.slots.clear(region));
      },
      clearAll: () => {
        if (controllerRef?.slots) {
          return controllerRef.slots.clearAll();
        }
        pendingManagerSlotOps.push((ctrl: MultiWorkflowController) => ctrl.slots.clearAll());
      },
    },
    
    // Multi-workflow methods
    createInstance: (factory, opts) => controllerRef?.createInstance(factory, opts) || "",
    removeInstance: (id, options) => controllerRef?.removeInstance(id, options),
    switchToInstance: (id) => controllerRef?.switchToInstance(id),
    closeInstance: (id) => controllerRef?.closeInstance(id),
    killInstance: (id) => controllerRef?.killInstance(id),
    listInstances: () => controllerRef?.listInstances() || [],
    getActiveInstance: () => controllerRef?.getActiveInstance() || null,
    findInstance: (predicate) => controllerRef?.findInstance(predicate) || null,
    listAvailableWorkflows: () => controllerRef?.listAvailableWorkflows() || [],
    openLauncher: () => { controllerRef?.openLauncher && controllerRef.openLauncher(); },
    sendToWorkflow: (id, message) => controllerRef?.sendToWorkflow(id, message),
    broadcastToAll: (message, excludeActive) => controllerRef?.broadcastToAll(message, excludeActive),
    getWorkflowsRequiringAttention: () => controllerRef?.getWorkflowsRequiringAttention() || [],
    switchToNextAttention: () => controllerRef?.switchToNextAttention() || false,
    switchToNextNonLoading: () => controllerRef?.switchToNextNonLoading() || false,
    switchToPreviousNonLoading: () => controllerRef?.switchToPreviousNonLoading() || false,
    updateWorkflowAttention: (workflowId, updates) => controllerRef?.updateWorkflowAttention(workflowId, updates),
    updateWorkflowStatus: (workflowId, status) => controllerRef?.updateWorkflowStatus(workflowId, status),
    markAttentionHandled: (workflowId) => controllerRef?.markAttentionHandled(workflowId),
    onWorkflowEvent: (type, handler) => controllerRef?.onWorkflowEvent(type, handler) || (() => {}),
    offWorkflowEvent: (type, handler) => controllerRef?.offWorkflowEvent(type, handler),
  };
  return proxy;
}
