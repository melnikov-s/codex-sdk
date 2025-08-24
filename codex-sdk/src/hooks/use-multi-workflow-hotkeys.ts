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
    workflows,
    activeWorkflowId,
    switchToWorkflow,
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
      key: "[",
      ctrl: true,
      action: switchToPreviousWorkflow,
      description: "Previous workflow",
    },
    {
      key: "escape",
      action: switchToPreviousWorkflow,
      description: "Escape (Ctrl+[)",
    },
    // Raw control codes (some terminals don't set key.ctrl for these)
    {
      key: "\u001d",
      action: switchToNextWorkflow,
      description: "Ctrl+] (raw)",
    },
    {
      key: "\u001b",
      action: switchToPreviousWorkflow,
      description: "Ctrl+[ (raw)",
    },
  ];

  // Add Ctrl+Tab / Ctrl+Shift+Tab fallbacks
  hotkeys.push(HotkeyPatterns.ctrlTab(switchToNextWorkflow));
  hotkeys.push(HotkeyPatterns.ctrlShiftTab(switchToPreviousWorkflow));

  // Ctrl+O to open workflow picker
  hotkeys.push({
    key: "o",
    ctrl: true,
    action: openWorkflowPicker,
    description: "Ctrl+O",
  });

  // Add Ctrl+1..9 direct switching
  for (let i = 1; i <= 9; i++) {
    hotkeys.push({
      ...HotkeyPatterns.ctrlNumber(i, () => {
        const idx = i - 1;
        const target = workflows[idx];
        if (!target) {
          return;
        }
        if (target.id !== activeWorkflowId) {
          switchToWorkflow(target.id);
        }
      }),
    });
  }

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
