import {
  useGlobalHotkeys,
  type HotkeyAction,
  HotkeyPatterns,
} from "./use-global-hotkeys.js";

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

export function useMultiWorkflowHotkeys(params: MultiWorkflowHotkeysParams) {
  const {
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    openWorkflowPicker,
    enabled = true,
  } = params;

  const hotkeys: Array<HotkeyAction> = [
    {
      key: "]",
      ctrl: true,
      action: switchToNextWorkflow,
      description: "Next workflow",
    },
    {
      key: "o",
      ctrl: true,
      action: switchToPreviousWorkflow,
      description: "Previous workflow",
    },
    {
      key: "p",
      ctrl: true,
      action: switchToNextWorkflow,
      description: "Next workflow",
    },

    // Raw control codes for Ctrl+] only (Ctrl+[ conflicts with ESC)
    {
      key: "\u001d",
      action: switchToNextWorkflow,
      description: "Ctrl+] (raw)",
    },
  ];

  // Add Ctrl+Tab / Ctrl+Shift+Tab fallbacks
  hotkeys.push(HotkeyPatterns.ctrlTab(switchToNextWorkflow));
  hotkeys.push(HotkeyPatterns.ctrlShiftTab(switchToPreviousWorkflow));

  // Ctrl+Shift+O to open workflow picker (moved from Ctrl+O to avoid conflict)
  hotkeys.push({
    key: "o",
    ctrl: true,
    shift: true,
    action: openWorkflowPicker,
    description: "Open workflow picker",
  });

  useGlobalHotkeys({
    hotkeys,
    enabled,
    priority: 1,
  });

  return {
    hotkeys,
    isEnabled: enabled,
  };
}
