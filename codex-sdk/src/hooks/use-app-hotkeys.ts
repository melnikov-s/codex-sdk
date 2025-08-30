import { useGlobalHotkeys } from "./use-global-hotkeys.js";
import { useMultiWorkflowHotkeys } from "./use-multi-workflow-hotkeys.js";
import { clearTerminal } from "../utils/terminal.js";
import { useMemo } from "react";

export interface CurrentWorkflowForHotkeys {
  id: string;
  displayTitle: string;
}

export interface UseAppHotkeysParams {
  currentWorkflows: Array<CurrentWorkflowForHotkeys>;
  activeWorkflowId: string;
  switchToWorkflow: (workflowId: string) => void;
  switchToNextWorkflow: () => void;
  switchToPreviousWorkflow: () => void;
  switchToNextNonLoading: () => boolean;
  openWorkflowPicker: () => void;
  openAppPalette: () => void;
  createNewWorkflow: () => void;
}

export function useAppHotkeys({
  currentWorkflows,
  activeWorkflowId,
  switchToWorkflow,
  switchToNextWorkflow,
  switchToPreviousWorkflow,
  switchToNextNonLoading,
  openWorkflowPicker,
  openAppPalette,
  createNewWorkflow,
}: UseAppHotkeysParams) {
  // Workflow-specific hotkeys
  const { hotkeys: workflowHotkeys } = useMultiWorkflowHotkeys({
    workflows: currentWorkflows.map(({ id, displayTitle }) => ({
      id,
      title: displayTitle,
    })),
    activeWorkflowId,
    switchToWorkflow: (workflowId: string) => {
      clearTerminal();
      switchToWorkflow(workflowId);
    },
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    switchToNextAttention: () => false,
    switchToNextNonLoading,
    openWorkflowPicker,
    createNewWorkflow,
    killCurrentWorkflow: () => {},
    emergencyExit: () => {},
  });

  // Global app palette hotkeys (Cmd/Ctrl+K, Cmd/Ctrl+Shift+P, F1)
  const appHotkeys = useMemo(
    () => [
      {
        key: "k",
        ctrl: true,
        action: () => {
          clearTerminal();
          openAppPalette();
        },
        description: "App commands",
      },
    ],
    [openAppPalette],
  );

  useGlobalHotkeys({
    hotkeys: appHotkeys,
    enabled: true,
  });

  const allHotkeys = useMemo(
    () => [...workflowHotkeys, ...appHotkeys],
    [workflowHotkeys, appHotkeys],
  );

  return allHotkeys;
}
