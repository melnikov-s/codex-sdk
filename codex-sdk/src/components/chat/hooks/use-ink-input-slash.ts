import type { OverlayModeType } from "../types.js";
import type { SelectionState } from "./use-overlays.js";

import { useInput } from "ink";

export function useInkInputSlash(params: {
  overlayMode: OverlayModeType;
  selectionState: SelectionState;
  setQuickSlashBuffer: (val: string | null) => void;
  selectionBackupRef: { current: SelectionState };
  inputSetterRef: React.MutableRefObject<((value: string) => void) | undefined>;
  isActive?: boolean;
}) {
  const { overlayMode, selectionState, setQuickSlashBuffer, selectionBackupRef, inputSetterRef, isActive = true } = params;

  useInput(
    (input, key) => {
      const selectionOpen = overlayMode === "selection";
      if (selectionOpen && input === "/" && !key.ctrl && !key.meta) {
        if (selectionState && !selectionBackupRef.current) {
          selectionBackupRef.current = selectionState;
        }
        setQuickSlashBuffer("/");
        setTimeout(() => {
          try {
            inputSetterRef.current?.("/");
          } catch {
            // ignore
          }
        }, 0);
      }
    },
    { isActive },
  );
}


