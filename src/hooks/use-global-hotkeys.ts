import { useInput } from "ink";

export interface HotkeyAction {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  action: () => void;
  description?: string;
}

export interface UseGlobalHotkeysParams {
  hotkeys: Array<HotkeyAction>;
  enabled?: boolean;
  priority?: number;
}

export const HotkeyPatterns = {
  ctrlTab: (action: () => void): HotkeyAction => ({
    key: "tab",
    ctrl: true,
    action,
    description: "Ctrl+Tab",
  }),

  ctrlShiftTab: (action: () => void): HotkeyAction => ({
    key: "tab",
    ctrl: true,
    shift: true,
    action,
    description: "Ctrl+Shift+Tab",
  }),
};

export function useGlobalHotkeys({
  hotkeys,
  enabled = true,
}: UseGlobalHotkeysParams) {
  useInput((input, key) => {
    if (!enabled) {
      return;
    }

    for (const hotkey of hotkeys) {
      let matchesKey = false;
      let matchesCtrl = !hotkey.ctrl;
      let matchesMeta = !hotkey.meta;
      let matchesShift = !hotkey.shift;

      // Handle raw control codes first - these match directly
      if (hotkey.key === input && (input === "\u001d" || input === "\u001b")) {
        matchesKey = true;
        matchesCtrl = !hotkey.ctrl;
        matchesMeta = !hotkey.meta;
        matchesShift = !hotkey.shift;
      }
      // Handle regular key matches
      else if (
        hotkey.key === input ||
        hotkey.key === (key as { name?: string }).name
      ) {
        matchesKey = true;
        if (hotkey.ctrl) {
          matchesCtrl = key.ctrl;
        }
        if (hotkey.meta) {
          matchesMeta = key.meta;
        }
        if (hotkey.shift) {
          matchesShift = key.shift;
        }
      }

      if (matchesKey && matchesCtrl && matchesMeta && matchesShift) {
        hotkey.action();
        break;
      }
    }
  });
}
