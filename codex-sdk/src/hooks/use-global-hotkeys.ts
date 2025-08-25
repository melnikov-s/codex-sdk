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

    const normalizedInput = (key as { escape?: boolean }).escape
      ? "["
      : input === "\u001d"
        ? "]"
        : input === "\u001b"
          ? "["
          : input;

    for (const hotkey of hotkeys) {
      const matchesKey =
        hotkey.key === normalizedInput ||
        hotkey.key === (key as { name?: string }).name;
      const isCtrlBracketEquivalent =
        (hotkey.key === "[" &&
          (input === "\u001b" || (key as { escape?: boolean }).escape)) ||
        (hotkey.key === "]" && input === "\u001d");
      const matchesCtrl = !hotkey.ctrl || key.ctrl || isCtrlBracketEquivalent;
      const matchesMeta = !hotkey.meta || key.meta;
      const matchesShift = !hotkey.shift || key.shift;

      if (matchesKey && matchesCtrl && matchesMeta && matchesShift) {
        hotkey.action();
        break;
      }
    }
  });
}
