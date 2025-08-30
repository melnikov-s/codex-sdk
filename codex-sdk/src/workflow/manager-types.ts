import type { WorkflowFactory, WorkflowState, DisplayConfig } from "./index.js";
import type { ApprovalPolicy } from "../approvals.js";
import type { CustomizableHotkeyConfig } from "../hooks/use-customizable-hotkeys.js";
import type { LibraryConfig } from "../utils/workflow-config.js";
import type { ModelMessage } from "ai";
import type React from "react";

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
  setTitle(title: React.ReactNode): void;
  setApprovalPolicy(policy: ApprovalPolicy): void;
  setConfig(config: Partial<LibraryConfig>): void;
  setHotkeyConfig(config: Partial<CustomizableHotkeyConfig>): void;

  // Read-only properties
  readonly title: React.ReactNode;
  readonly approvalPolicy: ApprovalPolicy;
  readonly config: LibraryConfig;
  readonly hotkeyConfig: CustomizableHotkeyConfig;
}
