// Hotkeys temporarily disabled per request – do not register any Ctrl-based shortcuts

export interface MultiWorkflowHotkeysParams {
  workflows: Array<{ id: string; title: string }>;
  activeWorkflowId: string;
  switchToWorkflow: (id: string) => void;
  switchToNextWorkflow: () => void;
  switchToPreviousWorkflow: () => void;
  switchToNextAttention: () => boolean;
  switchToNextNonLoading?: () => boolean;
  switchToPreviousNonLoading?: () => boolean;
  openWorkflowPicker: () => void;
  createNewWorkflow: () => void;
  closeCurrentWorkflow: () => void;
  killCurrentWorkflow: () => void;
  emergencyExit: () => void;
  enabled?: boolean;
}

export function useMultiWorkflowHotkeys(_params: MultiWorkflowHotkeysParams) {
  // Temporarily disable all hotkeys
  return {
    hotkeys: [],
    isEnabled: false,
  };
}

// Helper function to get workflow navigation summary
export function getWorkflowHotkeysSummary(
  _workflows: Array<{ id: string; title: string }>,
) {
  const summary = [
    "Workflow Navigation hotkeys are disabled.",
  ];

  // No hotkey listing while disabled

  return summary.join("\n");
}
