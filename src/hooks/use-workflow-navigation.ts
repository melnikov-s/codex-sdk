import { clearTerminal } from "../utils/terminal.js";
import { useCallback } from "react";

export interface CurrentWorkflow {
  id: string;
  isLoading?: boolean;
}

export interface UseWorkflowNavigationParams {
  currentWorkflows: Array<CurrentWorkflow>;
  activeWorkflowId: string;
  setActiveWorkflowId: (id: string) => void;
}

export interface UseWorkflowNavigationReturn {
  switchToNextWorkflow: () => void;
  switchToPreviousWorkflow: () => void;
  switchToNextNonLoading: () => boolean;
}

export function useWorkflowNavigation({
  currentWorkflows,
  activeWorkflowId,
  setActiveWorkflowId,
}: UseWorkflowNavigationParams): UseWorkflowNavigationReturn {
  const switchToNextWorkflow = useCallback(() => {
    if (currentWorkflows.length <= 1) {
      return;
    }
    clearTerminal();
    const currentIndex = currentWorkflows.findIndex(
      (w) => w.id === activeWorkflowId,
    );
    const nextIndex = (currentIndex + 1) % currentWorkflows.length;
    setActiveWorkflowId(currentWorkflows[nextIndex]?.id || "");
  }, [currentWorkflows, activeWorkflowId, setActiveWorkflowId]);

  const switchToPreviousWorkflow = useCallback(() => {
    if (currentWorkflows.length <= 1) {
      return;
    }
    clearTerminal();
    const currentIndex = currentWorkflows.findIndex(
      (w) => w.id === activeWorkflowId,
    );
    const prevIndex =
      (currentIndex - 1 + currentWorkflows.length) % currentWorkflows.length;
    setActiveWorkflowId(currentWorkflows[prevIndex]?.id || "");
  }, [currentWorkflows, activeWorkflowId, setActiveWorkflowId]);

  const switchToNextNonLoading = useCallback(() => {
    if (currentWorkflows.length <= 1) {
      return false;
    }

    const nonLoadingWorkflows = currentWorkflows.filter((w) => !w.isLoading);
    if (nonLoadingWorkflows.length === 0) {
      return false;
    }

    clearTerminal();
    const currentIndex = nonLoadingWorkflows.findIndex(
      (w) => w.id === activeWorkflowId,
    );

    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % nonLoadingWorkflows.length;

    setActiveWorkflowId(nonLoadingWorkflows[nextIndex]?.id || "");
    return true;
  }, [currentWorkflows, activeWorkflowId, setActiveWorkflowId]);

  return {
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    switchToNextNonLoading,
  };
}
