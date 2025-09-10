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
export type {
  AvailableWorkflow,
  InitialWorkflowRef,
} from "./workflow/multi-types.js";

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

// Export workflow API types
export type {
  WorkflowInstance,
  WorkflowEventType,
  WorkflowEvent,
  WorkflowEventListener,
  WorkflowManager,
} from "./workflow/manager-types.js";
export type {
  LibraryConfig,
  HeaderConfig,
  SingleWorkflowOptions,
  MultiWorkflowOptions,
} from "./utils/workflow-config.js";

// Import necessary components
import type {
  SingleWorkflowOptions,
  MultiWorkflowOptions,
} from "./utils/workflow-config.js";
import type { WorkflowController, WorkflowFactory } from "./workflow/index.js";
import type { WorkflowManager } from "./workflow/manager-types.js";

import { runHeadless as runHeadlessInternal } from "./headless/index.js";
import { AutoApprovalMode } from "./utils/auto-approval-mode";
import {
  renderSingleWorkflow,
  renderMultiWorkflow,
} from "./utils/render-ui.js";
import { attachExitHandlers } from "./utils/signal-handlers.js";
import { WorkflowManagerImpl } from "./workflow/manager.js";

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
    manager.initializeFromOptions({
      title: multiOptions.title || "Multi-Workflow Environment",
      approvalPolicy: multiOptions.approvalPolicy || AutoApprovalMode.SUGGEST,
      config: multiOptions.config || {},
      hotkeyConfig: multiOptions.hotkeyConfig,
    });

    // Track all controllers
    const controllers: Array<WorkflowController> = [];

    // Render the App with multiple workflows
    renderMultiWorkflow(workflows, multiOptions, manager, (controller) => {
      controllers.push(controller);
      multiOptions.onController?.(controller);
    });

    // Set up signal handlers
    attachExitHandlers(() => {
      controllers.forEach((c) => c.terminate());
    });

    // Set up manager terminate function
    manager.terminate = (code?: number) => {
      controllers.forEach((c) => c.terminate(code));
      process.exit(0);
    };

    return manager;
  } else {
    // Single workflow implementation
    const singleOptions = options as SingleWorkflowOptions;
    const manager = new WorkflowManagerImpl(singleOptions.headless || false);

    // Initialize manager with provided options
    manager.initializeFromOptions({
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
      // Render the App with the custom workflow
      renderSingleWorkflow(workflows, singleOptions, manager, (c) => {
        controllerRef = c;
        singleOptions.onController?.(c);
      });

      // Set up signal handlers
      attachExitHandlers(() => {
        controllerRef?.terminate();
      });
    }

    // Set up manager terminate function
    manager.terminate = (code?: number) => controllerRef?.terminate(code);

    return manager;
  }
}
