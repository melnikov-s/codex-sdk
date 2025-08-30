import type { ExtendedWorkflowInstance } from "./use-workflows.js";
import type { ApprovalPolicy } from "../approvals.js";
import type {
  WorkflowFactory,
  WorkflowController,
  WorkflowState,
} from "../workflow/index.js";
import type { WorkflowManager } from "../workflow/manager-types.js";

import { useEffect } from "react";

export interface UseManagerBridgeParams {
  manager?: WorkflowManager;
  currentWorkflows: Array<{
    id: string;
    displayTitle: string;
    factory: WorkflowFactory;
    isLoading?: boolean;
  }>;
  activeWorkflowId: string;
  createWorkflow: (
    factory: WorkflowFactory,
    options?: { activate?: boolean },
  ) => ExtendedWorkflowInstance;
  closeWorkflow: (id: string) => void;
  switchToWorkflow: (id: string) => void;
  switchToNextWorkflow: () => void;
  switchToPreviousWorkflow: () => void;
  switchToNextNonLoading: () => boolean;
  workflowInstancesRef: React.MutableRefObject<
    Map<string, ExtendedWorkflowInstance>
  >;
  managerTitle: React.ReactNode;
  setManagerTitle: (title: React.ReactNode) => void;
  currentApprovalPolicy: ApprovalPolicy;
  setCurrentApprovalPolicy: (policy: ApprovalPolicy) => void;
}

export function useManagerBridge({
  manager,
  currentWorkflows,
  activeWorkflowId,
  createWorkflow,
  closeWorkflow,
  switchToWorkflow,
  switchToNextWorkflow,
  switchToPreviousWorkflow,
  switchToNextNonLoading,
  workflowInstancesRef,
  setManagerTitle,
  setCurrentApprovalPolicy,
}: UseManagerBridgeParams): void {
  // Set up manager state updaters
  useEffect(() => {
    if (manager && "setAppStateUpdaters" in manager) {
      const managerWithUpdaters = manager as WorkflowManager & {
        setAppStateUpdaters: (updaters: {
          setTitle?: (title: React.ReactNode) => void;
          setApprovalPolicy?: (policy: ApprovalPolicy) => void;
          setConfig?: (config: unknown) => void;
          updateHotkeyConfig?: (config: unknown) => void;
          createWorkflow?: (
            factory: WorkflowFactory,
            options?: { activate?: boolean },
          ) => Promise<ExtendedWorkflowInstance>;
          closeWorkflow?: (workflow: {
            title: string;
            factory: WorkflowFactory;
          }) => Promise<boolean>;
          switchToWorkflow?: (workflow: {
            title: string;
            factory: WorkflowFactory;
          }) => Promise<boolean>;
          getActiveWorkflow?: () => unknown;
          switchToNextWorkflow?: () => boolean;
          switchToPreviousWorkflow?: () => boolean;
          switchToNextNonLoadingWorkflow?: () => boolean;
        }) => void;
        addWorkflow?: (
          workflow: ExtendedWorkflowInstance,
          controller: WorkflowController,
        ) => void;
        removeWorkflow?: (workflow: ExtendedWorkflowInstance) => void;
        switchWorkflow?: (
          fromWorkflow: ExtendedWorkflowInstance | null,
          toWorkflow: ExtendedWorkflowInstance,
        ) => void;
        updateWorkflowLoading?: (
          workflow: ExtendedWorkflowInstance,
          isLoading: boolean,
        ) => void;
        updateWorkflowReady?: (
          workflow: ExtendedWorkflowInstance,
          isReady: boolean,
        ) => void;
      };

      managerWithUpdaters.setAppStateUpdaters({
        setTitle: setManagerTitle,
        setApprovalPolicy: setCurrentApprovalPolicy,
        setConfig: (_config: unknown) => {
          // Config updates will be handled when we implement full config management
        },
        updateHotkeyConfig: (_config: unknown) => {
          // Update hotkey config through context
          // This will be implemented when we update the hotkey integration
        },
        createWorkflow: async (
          factory: WorkflowFactory,
          options?: { activate?: boolean },
        ) => {
          const instance = createWorkflow(factory, options);

          // Emit workflow creation event if manager supports it
          if (managerWithUpdaters.addWorkflow) {
            // Controller will be added later when available
            // For now, we just return the instance
          }

          return instance;
        },
        closeWorkflow: async (workflow: {
          title: string;
          factory: WorkflowFactory;
        }) => {
          const workflowToClose = currentWorkflows.find(
            (w) =>
              w.displayTitle === workflow.title &&
              w.factory === workflow.factory,
          );
          if (workflowToClose) {
            // Emit workflow removal event if manager supports it
            if (managerWithUpdaters.removeWorkflow) {
              const instance = workflowInstancesRef.current.get(
                workflowToClose.id,
              );
              if (instance) {
                managerWithUpdaters.removeWorkflow(instance);
              }
            }

            closeWorkflow(workflowToClose.id);
            return true;
          }
          return false;
        },
        switchToWorkflow: async (workflow: {
          title: string;
          factory: WorkflowFactory;
        }) => {
          const workflowToSwitch = currentWorkflows.find(
            (w) =>
              w.displayTitle === workflow.title &&
              w.factory === workflow.factory,
          );
          if (workflowToSwitch) {
            // Emit workflow switch event if manager supports it
            if (managerWithUpdaters.switchWorkflow) {
              const fromInstance =
                workflowInstancesRef.current.get(activeWorkflowId);
              const toInstance = workflowInstancesRef.current.get(
                workflowToSwitch.id,
              );
              if (toInstance) {
                managerWithUpdaters.switchWorkflow(
                  fromInstance || null,
                  toInstance,
                );
              }
            }

            switchToWorkflow(workflowToSwitch.id);
            return true;
          }
          return false;
        },
        getActiveWorkflow: () => {
          const activeWorkflow = currentWorkflows.find(
            (w) => w.id === activeWorkflowId,
          );
          if (!activeWorkflow) {
            return null;
          }

          const instance = workflowInstancesRef.current.get(activeWorkflow.id);
          if (instance) {
            return {
              title: instance.title,
              factory: instance.factory,
              isActive: true,
              get state(): WorkflowState {
                return instance.state;
              },
              setState: instance.setState.bind(instance),
              getState: instance.getState.bind(instance),
              message: instance.message.bind(instance),
              stop: instance.stop.bind(instance),
              terminate: instance.terminate.bind(instance),
              get isLoading(): boolean {
                return instance.isLoading;
              },
            };
          }

          return {
            title: activeWorkflow.displayTitle,
            factory: activeWorkflow.factory,
            isActive: true,
            get state(): WorkflowState {
              return {
                loading: false,
                messages: [],
                inputDisabled: false,
                queue: [],
                taskList: [],
              };
            },
            setState: async () => {},
            getState: (): WorkflowState => ({
              loading: false,
              messages: [],
              inputDisabled: false,
              queue: [],
              taskList: [],
            }),
            message: () => {},
            stop: () => {},
            terminate: () => {},
            get isLoading(): boolean {
              return activeWorkflow.isLoading || false;
            },
          };
        },
        switchToNextWorkflow: () => {
          switchToNextWorkflow();
          return true;
        },
        switchToPreviousWorkflow: () => {
          switchToPreviousWorkflow();
          return true;
        },
        switchToNextNonLoadingWorkflow: () => {
          return switchToNextNonLoading();
        },
      });
    }
  }, [
    manager,
    currentWorkflows,
    activeWorkflowId,
    createWorkflow,
    closeWorkflow,
    switchToWorkflow,
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    switchToNextNonLoading,
    workflowInstancesRef,
    setManagerTitle,
    setCurrentApprovalPolicy,
  ]);
}
