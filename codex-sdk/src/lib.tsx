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

// Export multi-workflow types and components
export type { AvailableWorkflow, InitialWorkflowRef };

// Export App component for advanced usage
export { default as App } from "./app.js";

// Re-export approval mode constants for use by consumers
export { AutoApprovalMode } from "./utils/auto-approval-mode.js";
export { exit as exitSafely } from "./utils/terminal.js";

// Export approval types for use by consumers
export type { ApprovalPolicy, SafetyAssessment } from "./approvals.js";
export { getTextContent } from "./utils/ai.js";

// Export workflow API types (declared below)

// Import necessary components
import type { AvailableWorkflow, InitialWorkflowRef } from "./app.js";
import type { ApprovalPolicy } from "./approvals.js";
import type { UIMessage } from "./utils/ai.js";
import type { FullAutoErrorMode } from "./utils/auto-approval-mode.js";
import type {
  WorkflowController,
  WorkflowFactory,
  WorkflowState,
  DisplayConfig,
} from "./workflow/index.js";

import App from "./app.js";
import { runHeadless as runHeadlessInternal } from "./headless/index.js";
import { AutoApprovalMode } from "./utils/auto-approval-mode.js";
import { clearTerminal, onExit, setInkRenderer } from "./utils/terminal.js";
import { EventEmitter } from "events";
import { render } from "ink";
import React, { type ReactNode } from "react";

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
  title?: ReactNode;
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

/**
 * Workflow instance with state access
 */
export interface WorkflowInstance {
  title: string;
  factory: WorkflowFactory;
  isActive: boolean;
  state: WorkflowState;
  displayConfig?: DisplayConfig;
}

/**
 * Workflow event types
 */
export type WorkflowEventType =
  | "workflow:switch"
  | "workflow:create"
  | "workflow:close"
  | "workflow:loading"
  | "workflow:ready";

/**
 * Workflow event payload
 */
export interface WorkflowEvent {
  workflow: WorkflowInstance;
  previousWorkflow?: WorkflowInstance; // for switch events
}

export type WorkflowEventListener = (event: WorkflowEvent) => void;

/**
 * Event-driven workflow manager interface
 */
export interface WorkflowManager {
  /** Get all workflow instances */
  getWorkflows(): Array<WorkflowInstance>;
  /** Terminate all workflows and exit */
  terminate: (code?: number) => void;
  /** Whether running headless */
  headless: boolean;

  // Event registration
  on(event: WorkflowEventType, listener: WorkflowEventListener): void;
  off(event: WorkflowEventType, listener: WorkflowEventListener): void;
  once(event: WorkflowEventType, listener: WorkflowEventListener): void;
}

/**
 * Event-driven workflow manager implementation
 */
class WorkflowManagerImpl extends EventEmitter implements WorkflowManager {
  private workflows: Array<WorkflowInstance> = [];
  private controllers: Array<WorkflowController> = [];
  public readonly headless: boolean;

  constructor(headless: boolean = false) {
    super();
    this.headless = headless;
  }

  getWorkflows(): Array<WorkflowInstance> {
    return [...this.workflows];
  }

  terminate(code?: number): void {
    this.controllers.forEach((controller) => controller.terminate(code));
    this.emit("manager:terminating");
  }

  // EventEmitter methods are inherited

  // Internal methods for updating workflows
  _addWorkflow(
    workflow: WorkflowInstance,
    controller: WorkflowController,
  ): void {
    this.workflows.push(workflow);
    this.controllers.push(controller);
    this.emit("workflow:create", { workflow });
  }

  _removeWorkflow(workflow: WorkflowInstance): void {
    const index = this.workflows.findIndex((w) => w === workflow);
    if (index !== -1) {
      this.workflows.splice(index, 1);
      this.controllers.splice(index, 1);
      this.emit("workflow:close", { workflow });
    }
  }

  _switchWorkflow(
    fromWorkflow: WorkflowInstance | null,
    toWorkflow: WorkflowInstance,
  ): void {
    // Update active states
    this.workflows.forEach((w) => {
      w.isActive = w === toWorkflow;
    });
    this.emit("workflow:switch", {
      workflow: toWorkflow,
      previousWorkflow: fromWorkflow || undefined,
    });
  }

  _updateWorkflowLoading(
    workflow: WorkflowInstance,
    _isLoading: boolean,
  ): void {
    this.emit("workflow:loading", { workflow });
  }

  _updateWorkflowReady(workflow: WorkflowInstance, _isReady: boolean): void {
    this.emit("workflow:ready", { workflow });
  }
}

/**
 * Run single or multiple workflows
 *
 * Supports both single and multiple workflows:
 * - Single workflow: Pass WorkflowFactory directly
 * - Multiple workflows: Pass Array<WorkflowFactory>
 *
 * @param workflows Single workflow factory or array of workflow factories
 * @param options Optional configuration for workflow execution
 */
export function run(
  workflows: WorkflowFactory,
  options?: SingleWorkflowOptions,
): WorkflowManager;
export function run(
  workflows: Array<WorkflowFactory>,
  options?: MultiWorkflowOptions,
): WorkflowManager;
export function run(
  workflows: WorkflowFactory | Array<WorkflowFactory>,
  options: SingleWorkflowOptions | MultiWorkflowOptions = {},
): WorkflowManager {
  const isMulti = Array.isArray(workflows);

  if (isMulti) {
    // Multi-workflow implementation
    if ("headless" in options && options.headless) {
      throw new Error(
        "Headless mode is not supported for multi-workflow execution. " +
          "Multi-workflows require a UI for tabbed interface and workflow switching. " +
          "Use single workflow mode for headless execution.",
      );
    }

    const multiOptions = options as MultiWorkflowOptions;
    const manager = new WorkflowManagerImpl(false);

    // Create minimal UI config
    const uiConfig = multiOptions.config || {};

    // Track all controllers
    const controllers: Array<WorkflowController> = [];

    // Render the App with multiple workflows
    clearTerminal();
    const inkInstance = render(
      <App
        uiConfig={uiConfig}
        approvalPolicy={multiOptions.approvalPolicy || AutoApprovalMode.SUGGEST}
        additionalWritableRoots={multiOptions.additionalWritableRoots || []}
        fullStdout={multiOptions.fullStdout || false}
        workflows={workflows}
        initialWorkflows={multiOptions.initialWorkflows}
        title={multiOptions.title || "Multi-Workflow Environment"}
        onController={(controller) => {
          controllers.push(controller);
          multiOptions.onController?.(controller);
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

    // Fallback for Ctrl-C when stdin is in raw-mode (which Ink uses)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
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

    // Ensure terminal clean-up always runs
    process.once("exit", onExit);

    // Set up manager terminate function
    manager.terminate = (code?: number) => {
      controllers.forEach((c) => c.terminate(code));
      handleProcessExit();
    };

    return manager;
  } else {
    // Single workflow implementation
    const singleOptions = options as SingleWorkflowOptions;
    const manager = new WorkflowManagerImpl(singleOptions.headless || false);

    let controllerRef: WorkflowController | null = null;

    if (singleOptions.headless) {
      // Headless branch: no Ink. Return controller directly.
      controllerRef = runHeadlessInternal(workflows, {
        approvalPolicy: singleOptions.approvalPolicy,
        additionalWritableRoots: singleOptions.additionalWritableRoots,
        fullStdout: singleOptions.fullStdout,
        config: singleOptions.config,
        format: singleOptions.format,
        log: singleOptions.log,
      });
    } else {
      // Create minimal UI config
      const uiConfig = singleOptions.config || {};

      // Render the App with the custom workflow
      clearTerminal();
      const inkInstance = render(
        <App
          uiConfig={uiConfig}
          approvalPolicy={
            singleOptions.approvalPolicy || AutoApprovalMode.SUGGEST
          }
          additionalWritableRoots={singleOptions.additionalWritableRoots || []}
          fullStdout={singleOptions.fullStdout || false}
          workflowFactory={workflows}
          title={singleOptions.title}
          onController={(c) => {
            controllerRef = c;
            singleOptions.onController?.(c);
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

      // Fallback for Ctrl-C when stdin is in raw-mode (which Ink uses)
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
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

      // Ensure terminal clean-up always runs
      process.once("exit", onExit);
    }

    // Set up manager terminate function
    manager.terminate = (code?: number) => controllerRef?.terminate(code);

    return manager;
  }
}
