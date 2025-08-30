import type {
  DisplayConfig,
  WorkflowController,
  WorkflowFactory,
  WorkflowState,
} from "../workflow/index.js";
import type {
  AvailableWorkflow,
  InitialWorkflowRef,
} from "../workflow/multi-types.js";
import type { ModelMessage } from "ai";

import { computeDisplayTitles } from "../utils/display-titles.js";
import { generateWorkflowId } from "../utils/workflow-ids.js";
import { useState, useCallback, useRef, useEffect } from "react";

export type CurrentWorkflow = {
  id: string;
  factoryId: string;
  factory: WorkflowFactory;
  instanceIndex: number;
  displayTitle: string;
  controller?: WorkflowController;
  displayConfig?: DisplayConfig;
  isLoading?: boolean;
};

export type ExtendedWorkflowInstance = {
  title: string;
  factory: WorkflowFactory;
  isActive: boolean;
  state: WorkflowState;
  setState: (
    state: Partial<WorkflowState> | ((prev: WorkflowState) => WorkflowState),
  ) => Promise<void>;
  getState: () => WorkflowState;
  message: (input: string | ModelMessage) => void;
  stop: () => void;
  terminate: () => void;
  isLoading: boolean;
  updateController: (newController: WorkflowController) => void;
};

export interface UseWorkflowsParams {
  availableWorkflows: Array<AvailableWorkflow>;
  initialWorkflows?: Array<InitialWorkflowRef>;
}

export interface UseWorkflowsReturn {
  currentWorkflows: Array<CurrentWorkflow>;
  activeWorkflowId: string;
  setActiveWorkflowId: (id: string) => void;
  createWorkflow: (
    factory: WorkflowFactory,
    options?: { activate?: boolean },
  ) => ExtendedWorkflowInstance;
  closeWorkflow: (id: string) => void;
  switchToWorkflow: (id: string) => void;
  handleTitleChange: (id: string, title: string) => void;
  handleDisplayConfigChange: (
    id: string,
    displayConfig?: DisplayConfig,
  ) => void;
  handleLoadingStateChange: (id: string, isLoading: boolean) => void;
  handleController: (
    controller: WorkflowController,
    workflowId: string,
  ) => void;
  workflowInstancesRef: React.MutableRefObject<
    Map<string, ExtendedWorkflowInstance>
  >;
}

export function useWorkflows({
  availableWorkflows,
  initialWorkflows,
}: UseWorkflowsParams): UseWorkflowsReturn {
  const [currentWorkflows, setCurrentWorkflows] = useState<
    Array<CurrentWorkflow>
  >([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>("");

  // Store workflow instances by ID for direct access
  const workflowInstancesRef = useRef<Map<string, ExtendedWorkflowInstance>>(
    new Map(),
  );

  const handleTitleChange = useCallback((id: string, title: string) => {
    setCurrentWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, displayTitle: title } : w)),
    );
  }, []);

  const handleDisplayConfigChange = useCallback(
    (id: string, displayConfig?: DisplayConfig) => {
      setCurrentWorkflows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, displayConfig } : w)),
      );
    },
    [],
  );

  const handleLoadingStateChange = useCallback(
    (id: string, isLoading: boolean) => {
      setCurrentWorkflows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, isLoading } : w)),
      );
    },
    [],
  );

  const handleController = useCallback(
    (controller: WorkflowController, workflowId: string) => {
      setCurrentWorkflows((prev) => {
        const updated = prev.map((w) =>
          w.id === workflowId ? { ...w, controller } : w,
        );

        // Update stored workflow instances with new controller
        const storedInstance = workflowInstancesRef.current.get(workflowId);
        if (storedInstance) {
          storedInstance.updateController(controller);
        }

        return updated;
      });
    },
    [],
  );

  const createWorkflow = useCallback(
    (factory: WorkflowFactory, options?: { activate?: boolean }) => {
      const factoryId = generateWorkflowId(factory);
      const id = `${factoryId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newWorkflow: CurrentWorkflow = {
        id,
        factoryId,
        factory,
        instanceIndex: currentWorkflows.filter((w) => w.factoryId === factoryId)
          .length,
        displayTitle: factory.meta?.title || "Untitled",
      };

      // Create a WorkflowInstance with mutable controller reference
      let controller: WorkflowController | undefined = undefined;

      const workflowInstance: ExtendedWorkflowInstance = {
        title: newWorkflow.displayTitle,
        factory: newWorkflow.factory,
        get isActive(): boolean {
          return activeWorkflowId === id;
        },
        get state(): WorkflowState {
          return (
            controller?.getState() || {
              loading: false,
              messages: [],
              inputDisabled: false,
              queue: [],
              taskList: [],
            }
          );
        },
        setState: async (
          state:
            | Partial<WorkflowState>
            | ((prev: WorkflowState) => WorkflowState),
        ) => {
          if (controller?.setState) {
            await controller.setState(state);
          }
        },
        getState: (): WorkflowState => {
          return (
            controller?.getState() || {
              loading: false,
              messages: [],
              inputDisabled: false,
              queue: [],
              taskList: [],
            }
          );
        },
        message: (input: string | ModelMessage) => {
          if (controller) {
            controller.message(input);
          }
        },
        stop: () => {
          if (controller) {
            controller.stop();
          }
        },
        terminate: () => {
          if (controller) {
            controller.terminate();
          }
        },
        get isLoading(): boolean {
          const workflow = currentWorkflows.find((w) => w.id === id);
          return workflow?.isLoading || false;
        },
        updateController: (newController: WorkflowController) => {
          controller = newController;
        },
      };

      // Store the workflow instance for controller updates
      workflowInstancesRef.current.set(id, workflowInstance);

      setCurrentWorkflows((prev) => {
        const updated = [...prev, newWorkflow];
        return computeDisplayTitles(updated);
      });

      if (options?.activate) {
        setActiveWorkflowId(id);
      }

      return workflowInstance;
    },
    [currentWorkflows, activeWorkflowId],
  );

  const closeWorkflow = useCallback(
    (id: string) => {
      setCurrentWorkflows((prev) => prev.filter((w) => w.id !== id));
      workflowInstancesRef.current.delete(id);

      // If we're closing the active workflow, switch to another one
      setActiveWorkflowId((currentActive) => {
        if (currentActive === id) {
          const remaining = currentWorkflows.filter((w) => w.id !== id);
          return remaining[0]?.id || "";
        }
        return currentActive;
      });
    },
    [currentWorkflows],
  );

  const switchToWorkflow = useCallback((id: string) => {
    setActiveWorkflowId(id);
  }, []);

  // Initialize workflows on mount
  useEffect(() => {
    if (currentWorkflows.length > 0) {
      return;
    }

    if (initialWorkflows && initialWorkflows.length > 0) {
      const newWorkflows: Array<CurrentWorkflow> = [];
      initialWorkflows.forEach((ref) => {
        if ("id" in ref) {
          // Find workflow by generated ID
          const available = availableWorkflows.find(
            (w) => generateWorkflowId(w) === ref.id,
          );
          if (available) {
            const factoryId = generateWorkflowId(available);
            const id = `${factoryId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            newWorkflows.push({
              id,
              factoryId,
              factory: available,
              instanceIndex: 0,
              displayTitle: available.meta?.title || "Untitled",
            });
          }
        } else {
          // Direct factory reference
          const factory = ref;
          const factoryId = generateWorkflowId(factory);
          const id = `${factoryId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          newWorkflows.push({
            id,
            factoryId,
            factory,
            instanceIndex: 0,
            displayTitle: factory.meta?.title || "Untitled",
          });
        }
      });

      if (newWorkflows.length > 0) {
        setCurrentWorkflows(computeDisplayTitles(newWorkflows));
        setActiveWorkflowId(newWorkflows[0]?.id || "");
      }
    }
  }, [availableWorkflows, initialWorkflows, currentWorkflows.length]);

  return {
    currentWorkflows,
    activeWorkflowId,
    setActiveWorkflowId,
    createWorkflow,
    closeWorkflow,
    switchToWorkflow,
    handleTitleChange,
    handleDisplayConfigChange,
    handleLoadingStateChange,
    handleController,
    workflowInstancesRef,
  };
}
