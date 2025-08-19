import { useInput } from "ink";
import { useCallback, useEffect, useRef } from "react";

export interface HotkeyAction {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description?: string;
}

export interface UseGlobalHotkeysParams {
  hotkeys: Array<HotkeyAction>;
  enabled?: boolean;
  priority?: number; // Higher priority handlers run first
}

export function useGlobalHotkeys({ hotkeys, enabled = true, priority = 0 }: UseGlobalHotkeysParams) {
  const hotkeysRef = useRef(hotkeys);
  const enabledRef = useRef(enabled);
  const priorityRef = useRef(priority);

  // Update refs when props change
  useEffect(() => {
    hotkeysRef.current = hotkeys;
    enabledRef.current = enabled;
    priorityRef.current = priority;
  });

  const handleInput = useCallback((input: string, key: {
    name?: string;
    ctrl?: boolean;
    alt?: boolean;
    meta?: boolean;
    shift?: boolean;
    option?: boolean;
    rightArrow?: boolean;
    leftArrow?: boolean;
  }) => {
    if (!enabledRef.current) {return;}

    // Normalize key names for common terminals on macOS that don't report ctrl+tab/shift-tab
    const normalized = {
      name: key.name,
      ctrl: key.ctrl,
      alt: key.alt || key.meta || (process.platform === 'darwin' && (key.option || key.meta)),
      shift: key.shift,
      meta: key.meta,
    } as {
      name?: string;
      ctrl?: boolean;
      alt?: boolean;
      shift?: boolean;
      meta?: boolean;
    };

    // Fallbacks:
    // - map meta to alt for number combos (Cmd+1-9)
    // - treat ctrl+n/ctrl+p as next/prev tab when no direct ctrl+tab
    // - treat alt+left/right as previous/next tab

    const matchingHotkey = hotkeysRef.current.find(hotkey => {
      // Check basic key match
      const keyName = key.name || input;
      if (hotkey.key !== input && hotkey.key !== keyName) {return false;}
      
      // Check modifiers
      if (hotkey.ctrl && !normalized.ctrl) {return false;}
      if (hotkey.alt && !normalized.alt) {return false;}
      if (hotkey.shift && !normalized.shift) {return false;}
      if (hotkey.meta && !normalized.meta) {return false;}
      
      // Check that modifiers not specified are false
      if (!hotkey.ctrl && normalized.ctrl) {return false;}
      if (!hotkey.alt && normalized.alt) {return false;}
      if (!hotkey.shift && normalized.shift) {return false;}
      if (!hotkey.meta && normalized.meta) {return false;}
      
      return true;
    });

    if (matchingHotkey) {
      matchingHotkey.action();
      return;
    }

    // Global fallback bindings if no match found
    // ctrl+n/ctrl+p → emit synthetic Ctrl+Tab / Ctrl+Shift+Tab
    if (key.ctrl && (input === 'n' || input === 'p')) {
      const synthetic = input === 'n'
        ? HotkeyPatterns.ctrlTab(() => {})
        : HotkeyPatterns.ctrlShiftTab(() => {});
      const target = hotkeysRef.current.find(h => h.description === synthetic.description);
      target?.action();
      return;
    }
    // alt+arrowRight / alt+arrowLeft (or cmd on mac) → next/prev tab
    if ((normalized.alt) && (key.rightArrow || key.leftArrow)) {
      const synthetic = key.rightArrow
        ? HotkeyPatterns.ctrlTab(() => {})
        : HotkeyPatterns.ctrlShiftTab(() => {});
      const target = hotkeysRef.current.find(h => h.description === synthetic.description);
      target?.action();
      return;
    }
    // alt+1..9 (or cmd+1..9) → direct switch
    if (normalized.alt && /^[1-9]$/.test(input)) {
      const idx = parseInt(input, 10);
      const target = hotkeysRef.current.find(h => h.description === `Ctrl+${idx}` || h.description === `Alt+${idx}`);
      target?.action();
      return;
    }
  }, []);

  useInput(handleInput, { isActive: enabled });

  return {
    isEnabled: enabled,
    priority,
  };
}

// Utility function to create hotkey descriptors
export function createHotkey(
  key: string,
  action: () => void,
  modifiers: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {},
  description?: string
): HotkeyAction {
  return {
    key,
    action,
    description,
    ...modifiers,
  };
}

// Common hotkey patterns
export const HotkeyPatterns = {
  // Numbers 1-9 with Ctrl
  ctrlNumber: (num: number, action: () => void) => 
    createHotkey(num.toString(), action, { ctrl: true }, `Ctrl+${num}`),
  
  // Numbers 1-9 with Ctrl+Alt
  ctrlAltNumber: (num: number, action: () => void) => 
    createHotkey(num.toString(), action, { ctrl: true, alt: true }, `Ctrl+Alt+${num}`),
  
  // Tab navigation
  ctrlTab: (action: () => void) => 
    createHotkey("tab", action, { ctrl: true }, "Ctrl+Tab"),
  
  ctrlShiftTab: (action: () => void) => 
    createHotkey("tab", action, { ctrl: true, shift: true }, "Ctrl+Shift+Tab"),
  
  // Special keys
  ctrlBacktick: (action: () => void) => 
    createHotkey("`", action, { ctrl: true }, "Ctrl+`"),
  
  ctrlC: (action: () => void) => 
    createHotkey("c", action, { ctrl: true }, "Ctrl+C"),
  
  ctrlShiftC: (action: () => void) => 
    createHotkey("c", action, { ctrl: true, shift: true }, "Ctrl+Shift+C"),
  
  ctrlW: (action: () => void) => 
    createHotkey("w", action, { ctrl: true }, "Ctrl+W"),
  
  ctrlT: (action: () => void) => 
    createHotkey("t", action, { ctrl: true }, "Ctrl+T"),
  
  // Bracket navigation
  ctrlRightBracket: (action: () => void) => 
    createHotkey("]", action, { ctrl: true }, "Ctrl+]"),
  
  ctrlLeftBracket: (action: () => void) => 
    createHotkey("[", action, { ctrl: true }, "Ctrl+["),
  
  ctrlBackslash: (action: () => void) => 
    createHotkey("\\", action, { ctrl: true }, "Ctrl+\\"),
};
