import { useHotkeyConfig } from "./use-customizable-hotkeys.js";
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
  killCurrentWorkflow: () => void;
  emergencyExit: () => void;
  enabled?: boolean;
}

export function useMultiWorkflowHotkeys(params: MultiWorkflowHotkeysParams) {
  const {
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    switchToNextNonLoading,
    enabled = true,
  } = params;

  // openWorkflowPicker is in params but not used (removed hotkey)

  const { config } = useHotkeyConfig();

  const hotkeys: Array<HotkeyAction> = [
    {
      key: config.previousWorkflow.key || "o",
      ctrl: config.previousWorkflow.ctrl,
      meta: config.previousWorkflow.meta,
      shift: config.previousWorkflow.shift,
      action: switchToPreviousWorkflow,
      description: "Previous workflow",
    },
    {
      key: config.nextWorkflow.key || "p",
      ctrl: config.nextWorkflow.ctrl,
      meta: config.nextWorkflow.meta,
      shift: config.nextWorkflow.shift,
      action: switchToNextWorkflow,
      description: "Next workflow",
    },
  ];

  if (switchToNextNonLoading) {
    hotkeys.push({
      key: config.nextNonLoading.key || "n",
      ctrl: config.nextNonLoading.ctrl,
      meta: config.nextNonLoading.meta,
      shift: config.nextNonLoading.shift,
      action: switchToNextNonLoading,
      description: "Next non-loading workflow",
    });
  }

  // Add Ctrl+Tab / Ctrl+Shift+Tab fallbacks
  hotkeys.push(HotkeyPatterns.ctrlTab(switchToNextWorkflow));
  hotkeys.push(HotkeyPatterns.ctrlShiftTab(switchToPreviousWorkflow));

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
