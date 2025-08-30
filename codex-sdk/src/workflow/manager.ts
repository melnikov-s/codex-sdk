import type { WorkflowController, WorkflowFactory } from "./index.js";
import type { WorkflowManager, WorkflowInstance } from "./manager-types.js";
import type { ApprovalPolicy } from "../approvals.js";
import type { CustomizableHotkeyConfig } from "../hooks/use-customizable-hotkeys.js";
import type { LibraryConfig } from "../utils/workflow-config.js";
import type React from "react";

import { AutoApprovalMode } from "../utils/auto-approval-mode.js";
import { EventEmitter } from "events";

/**
 * Event-driven workflow manager implementation
 */
export class WorkflowManagerImpl
  extends EventEmitter
  implements WorkflowManager
{
  private workflows: Array<WorkflowInstance> = [];
  private controllers: Array<WorkflowController> = [];
  public readonly headless: boolean;

  // Manager properties
  private titleValue: React.ReactNode = "Multi-Workflow Environment";
  private approvalPolicyValue: ApprovalPolicy = AutoApprovalMode.SUGGEST;
  private configValue: LibraryConfig = {};
  private hotkeyConfigValue: CustomizableHotkeyConfig = {
    previousWorkflow: { key: "o", ctrl: true },
    nextWorkflow: { key: "p", ctrl: true },
    nextNonLoading: { key: "n", ctrl: true },
    appCommands: { key: "k", ctrl: true },
  };

  // React integration callbacks
  private appStateUpdaters: {
    setTitle?: (title: React.ReactNode) => void;
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
  get title(): React.ReactNode {
    return this.titleValue;
  }

  get approvalPolicy(): ApprovalPolicy {
    return this.approvalPolicyValue;
  }

  get config(): LibraryConfig {
    return this.configValue;
  }

  get hotkeyConfig(): CustomizableHotkeyConfig {
    return this.hotkeyConfigValue;
  }

  // Property setters (with React state propagation)
  setTitle(title: React.ReactNode): void {
    this.titleValue = title;
    this.appStateUpdaters.setTitle?.(title);
  }

  setApprovalPolicy(policy: ApprovalPolicy): void {
    this.approvalPolicyValue = policy;
    this.appStateUpdaters.setApprovalPolicy?.(policy);
  }

  setConfig(config: Partial<LibraryConfig>): void {
    this.configValue = { ...this.configValue, ...config };
    this.appStateUpdaters.setConfig?.(this.configValue);
  }

  setHotkeyConfig(config: Partial<CustomizableHotkeyConfig>): void {
    this.hotkeyConfigValue = { ...this.hotkeyConfigValue, ...config };
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
  setAppStateUpdaters(updaters: typeof this.appStateUpdaters): void {
    this.appStateUpdaters = updaters;
  }

  // Internal method to initialize from run() options
  initializeFromOptions(options: {
    title: React.ReactNode;
    approvalPolicy: ApprovalPolicy;
    config: LibraryConfig;
    hotkeyConfig?: Partial<CustomizableHotkeyConfig>;
  }): void {
    this.titleValue = options.title;
    this.approvalPolicyValue = options.approvalPolicy;
    this.configValue = options.config;
    if (options.hotkeyConfig) {
      this.hotkeyConfigValue = {
        ...this.hotkeyConfigValue,
        ...options.hotkeyConfig,
      };
    }
  }

  // Internal methods for updating workflows (keep existing for compatibility)
  addWorkflow(
    workflow: WorkflowInstance,
    controller: WorkflowController,
  ): void {
    this.workflows.push(workflow);
    this.controllers.push(controller);
    this.emit("workflow:create", { workflow });
  }

  removeWorkflow(workflow: WorkflowInstance): void {
    const index = this.workflows.findIndex((w) => w === workflow);
    if (index !== -1) {
      this.workflows.splice(index, 1);
      this.controllers.splice(index, 1);
      this.emit("workflow:close", { workflow });
    }
  }

  switchWorkflow(
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

  updateWorkflowLoading(workflow: WorkflowInstance, _isLoading: boolean): void {
    this.emit("workflow:loading", { workflow });
  }

  updateWorkflowReady(workflow: WorkflowInstance, _isReady: boolean): void {
    this.emit("workflow:ready", { workflow });
  }
}
