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

// Export hotkey customization types
export type { CustomizableHotkeyConfig } from "./hooks/use-customizable-hotkeys.js";

// Export workflow API types (declared below)

// Import necessary components
import type { AvailableWorkflow, InitialWorkflowRef } from "./app.js";
import type { ApprovalPolicy } from "./approvals.js";
import type { CustomizableHotkeyConfig } from "./hooks/use-customizable-hotkeys.js";
import type { UIMessage } from "./utils/ai.js";
import type { FullAutoErrorMode } from "./utils/auto-approval-mode.js";
import type {
  WorkflowController,
  WorkflowFactory,
  WorkflowState,
  DisplayConfig,
} from "./workflow/index.js";
import type { ModelMessage } from "ai";

import App from "./app.js";
import { runHeadless as runHeadlessInternal } from "./headless/index.js";
import { HotkeyProvider } from "./hooks/use-customizable-hotkeys.js";
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

/**
 * Workflow instance with state access
 */
export interface WorkflowInstance {
  title: string;
  factory: WorkflowFactory;
  isActive: boolean;
  state: WorkflowState;
  displayConfig?: DisplayConfig;

  // Direct state management (with React re-render propagation)
  setState(
    state: Partial<WorkflowState> | ((prev: WorkflowState) => WorkflowState),
  ): Promise<void>;
  getState(): WorkflowState;

  // Direct workflow control
  message(input: ModelMessage): void;
  stop(): void;
  terminate(): void;

  // Simple status
  isLoading: boolean;
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
  readonly headless: boolean;

  // Event registration
  on(event: WorkflowEventType, listener: WorkflowEventListener): void;
  off(event: WorkflowEventType, listener: WorkflowEventListener): void;
  once(event: WorkflowEventType, listener: WorkflowEventListener): void;

  // Core workflow management (Ctrl+K equivalents)
  createWorkflow(
    factory: WorkflowFactory,
    options?: { activate?: boolean },
  ): Promise<WorkflowInstance>;
  closeWorkflow(workflow: WorkflowInstance): Promise<boolean>;
  switchToWorkflow(workflow: WorkflowInstance): Promise<boolean>;
  getActiveWorkflow(): WorkflowInstance | null;

  // Workflow navigation
  switchToNextWorkflow(): boolean;
  switchToPreviousWorkflow(): boolean;
  switchToNextNonLoadingWorkflow(): boolean;

  // Manager property management (with React re-render propagation)
  setTitle(title: ReactNode): void;
  setApprovalPolicy(policy: ApprovalPolicy): void;
  setConfig(config: Partial<LibraryConfig>): void;
  setHotkeyConfig(config: Partial<CustomizableHotkeyConfig>): void;

  // Read-only properties
  readonly title: ReactNode;
  readonly approvalPolicy: ApprovalPolicy;
  readonly config: LibraryConfig;
  readonly hotkeyConfig: CustomizableHotkeyConfig;
}

/**
 * Event-driven workflow manager implementation
 */
class WorkflowManagerImpl extends EventEmitter implements WorkflowManager {
  private workflows: Array<WorkflowInstance> = [];
  private controllers: Array<WorkflowController> = [];
  public readonly headless: boolean;

  // Manager properties
  private _title: ReactNode = "Multi-Workflow Environment";
  private _approvalPolicy: ApprovalPolicy = AutoApprovalMode.SUGGEST;
  private _config: LibraryConfig = {};
  private _hotkeyConfig: CustomizableHotkeyConfig = {
    previousWorkflow: { key: "o", ctrl: true },
    nextWorkflow: { key: "p", ctrl: true },
    nextNonLoading: { key: "n", ctrl: true },
    appCommands: { key: "k", ctrl: true },
  };

  // React integration callbacks
  private appStateUpdaters: {
    setTitle?: (title: ReactNode) => void;
    setApprovalPolicy?: (policy: ApprovalPolicy) => void;
    setConfig?: (config: LibraryConfig) => void;
    updateHotkeyConfig?: (config: Partial<CustomizableHotkeyConfig>) => void;
    createWorkflow?: (
      factory: WorkflowFactory,
      options?: { activate?: boolean },
    ) => Promise<WorkflowInstance>;
    closeWorkflow?: (workflow: WorkflowInstance) => Promise<boolean>;
    switchToWorkflow?: (workflow: WorkflowInstance) => Promise<boolean>;
    getActiveWorkflow?: () => WorkflowInstance | null;
    switchToNextWorkflow?: () => boolean;
    switchToPreviousWorkflow?: () => boolean;
    switchToNextNonLoadingWorkflow?: () => boolean;
  } = {};

  constructor(headless: boolean = false) {
    super();
    this.headless = headless;
  }

  // Existing methods
  getWorkflows(): Array<WorkflowInstance> {
    return [...this.workflows];
  }

  terminate(code?: number): void {
    this.controllers.forEach((controller) => controller.terminate(code));
    this.emit("manager:terminating");
  }

  // Property getters
  get title(): ReactNode {
    return this._title;
  }

  get approvalPolicy(): ApprovalPolicy {
    return this._approvalPolicy;
  }

  get config(): LibraryConfig {
    return this._config;
  }

  get hotkeyConfig(): CustomizableHotkeyConfig {
    return this._hotkeyConfig;
  }

  // Property setters (with React state propagation)
  setTitle(title: ReactNode): void {
    this._title = title;
    this.appStateUpdaters.setTitle?.(title);
  }

  setApprovalPolicy(policy: ApprovalPolicy): void {
    this._approvalPolicy = policy;
    this.appStateUpdaters.setApprovalPolicy?.(policy);
  }

  setConfig(config: Partial<LibraryConfig>): void {
    this._config = { ...this._config, ...config };
    this.appStateUpdaters.setConfig?.(this._config);
  }

  setHotkeyConfig(config: Partial<CustomizableHotkeyConfig>): void {
    this._hotkeyConfig = { ...this._hotkeyConfig, ...config };
    this.appStateUpdaters.updateHotkeyConfig?.(config);
  }

  // Core workflow management (delegate to App component)
  async createWorkflow(
    factory: WorkflowFactory,
    options?: { activate?: boolean },
  ): Promise<WorkflowInstance> {
    if (!this.appStateUpdaters.createWorkflow) {
      throw new Error("Workflow creation not available in this context");
    }
    return this.appStateUpdaters.createWorkflow(factory, options);
  }

  async closeWorkflow(workflow: WorkflowInstance): Promise<boolean> {
    if (!this.appStateUpdaters.closeWorkflow) {
      throw new Error("Workflow closing not available in this context");
    }
    return this.appStateUpdaters.closeWorkflow(workflow);
  }

  async switchToWorkflow(workflow: WorkflowInstance): Promise<boolean> {
    if (!this.appStateUpdaters.switchToWorkflow) {
      throw new Error("Workflow switching not available in this context");
    }
    return this.appStateUpdaters.switchToWorkflow(workflow);
  }

  getActiveWorkflow(): WorkflowInstance | null {
    if (!this.appStateUpdaters.getActiveWorkflow) {
      return this.workflows.find((w) => w.isActive) || null;
    }
    return this.appStateUpdaters.getActiveWorkflow();
  }

  // Navigation methods (delegate to App component)
  switchToNextWorkflow(): boolean {
    if (!this.appStateUpdaters.switchToNextWorkflow) {
      return false;
    }
    return this.appStateUpdaters.switchToNextWorkflow();
  }

  switchToPreviousWorkflow(): boolean {
    if (!this.appStateUpdaters.switchToPreviousWorkflow) {
      return false;
    }
    return this.appStateUpdaters.switchToPreviousWorkflow();
  }

  switchToNextNonLoadingWorkflow(): boolean {
    if (!this.appStateUpdaters.switchToNextNonLoadingWorkflow) {
      return false;
    }
    return this.appStateUpdaters.switchToNextNonLoadingWorkflow();
  }

  // Internal method to set React state updaters (called by App component)
  _setAppStateUpdaters(updaters: typeof this.appStateUpdaters): void {
    this.appStateUpdaters = updaters;
  }

  // Internal method to initialize from run() options
  _initializeFromOptions(options: {
    title: ReactNode;
    approvalPolicy: ApprovalPolicy;
    config: LibraryConfig;
    hotkeyConfig?: Partial<CustomizableHotkeyConfig>;
  }): void {
    this._title = options.title;
    this._approvalPolicy = options.approvalPolicy;
    this._config = options.config;
    if (options.hotkeyConfig) {
      this._hotkeyConfig = { ...this._hotkeyConfig, ...options.hotkeyConfig };
    }
  }

  // Internal methods for updating workflows (keep existing for compatibility)
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

    // Initialize manager with provided options
    manager._initializeFromOptions({
      title: multiOptions.title || "Multi-Workflow Environment",
      approvalPolicy: multiOptions.approvalPolicy || AutoApprovalMode.SUGGEST,
      config: multiOptions.config || {},
      hotkeyConfig: multiOptions.hotkeyConfig,
    });

    // Create minimal UI config
    const uiConfig = multiOptions.config || {};

    // Track all controllers
    const controllers: Array<WorkflowController> = [];

    // Render the App with multiple workflows
    clearTerminal();
    const inkInstance = render(
      <HotkeyProvider initialConfig={multiOptions.hotkeyConfig}>
        <App
          uiConfig={uiConfig}
          approvalPolicy={
            multiOptions.approvalPolicy || AutoApprovalMode.SUGGEST
          }
          additionalWritableRoots={multiOptions.additionalWritableRoots || []}
          fullStdout={multiOptions.fullStdout || false}
          workflows={workflows}
          initialWorkflows={multiOptions.initialWorkflows}
          title={multiOptions.title || "Multi-Workflow Environment"}
          workflowManager={manager}
          onController={(controller) => {
            controllers.push(controller);
            multiOptions.onController?.(controller);
          }}
        />
      </HotkeyProvider>,
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

    // Initialize manager with provided options
    manager._initializeFromOptions({
      title: singleOptions.title || "Workflow Environment",
      approvalPolicy: singleOptions.approvalPolicy || AutoApprovalMode.SUGGEST,
      config: singleOptions.config || {},
      hotkeyConfig: singleOptions.hotkeyConfig,
    });

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
        <HotkeyProvider initialConfig={singleOptions.hotkeyConfig}>
          <App
            uiConfig={uiConfig}
            approvalPolicy={
              singleOptions.approvalPolicy || AutoApprovalMode.SUGGEST
            }
            additionalWritableRoots={
              singleOptions.additionalWritableRoots || []
            }
            fullStdout={singleOptions.fullStdout || false}
            workflowFactory={workflows}
            title={singleOptions.title}
            workflowManager={manager}
            onController={(c) => {
              controllerRef = c;
              singleOptions.onController?.(c);
            }}
          />
        </HotkeyProvider>,
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
