import type { AppCommand } from "../components/app-command-palette.js";

import { getEnabledAppCommands } from "../utils/app-commands.js";
import { useMemo } from "react";

export interface UseAppCommandsParams {
  currentWorkflowsLength: number;
  availableWorkflowsLength: number;
  switchToNextWorkflow: () => void;
  switchToPreviousWorkflow: () => void;
  openWorkflowSwitcher: () => void;
  openWorkflowPicker: () => void;
  closeAppPalette: () => void;
  openApprovalOverlay: () => void;
}

export function useAppCommands({
  currentWorkflowsLength,
  availableWorkflowsLength,
  switchToNextWorkflow,
  switchToPreviousWorkflow,
  openWorkflowSwitcher,
  openWorkflowPicker,
  closeAppPalette,
  openApprovalOverlay,
}: UseAppCommandsParams): Array<AppCommand> {
  return useMemo(() => {
    const defs = [
      {
        id: "workflow.switch",
        title: "Switch workflow…",
        run: () => openWorkflowSwitcher(),
        disabled: () => currentWorkflowsLength === 0,
      },
      {
        id: "workflow.new",
        title:
          availableWorkflowsLength === 1
            ? "Create new workflow"
            : "Create new workflow…",
        run: () => openWorkflowPicker(),
      },

      {
        id: "workflow.next",
        title: "Next workflow",
        run: () => switchToNextWorkflow(),
        disabled: () => currentWorkflowsLength <= 1,
      },
      {
        id: "workflow.prev",
        title: "Previous workflow",
        run: () => switchToPreviousWorkflow(),
        disabled: () => currentWorkflowsLength <= 1,
      },
      {
        id: "app.approval",
        title: "Change approval policy…",
        run: () => {
          closeAppPalette();
          openApprovalOverlay();
        },
      },
    ];
    return getEnabledAppCommands(defs).map(({ id, title, run }) => ({
      id,
      title,
      run,
    }));
  }, [
    currentWorkflowsLength,
    availableWorkflowsLength,
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    openWorkflowSwitcher,
    openWorkflowPicker,
    closeAppPalette,
    openApprovalOverlay,
  ]);
}
