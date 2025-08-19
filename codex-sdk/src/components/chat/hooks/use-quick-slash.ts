import type { SelectionState } from "./use-overlays.js";
import type { OverlayModeType } from "../types.js";

import { useEffect, useRef, useState } from "react";

export function useQuickSlash(params: {
  overlayMode: OverlayModeType;
  setOverlayMode: (mode: OverlayModeType) => void;
  selectionState: SelectionState;
  setSelectionState: (state: SelectionState) => void;
  inputSetterRef: React.MutableRefObject<((value: string) => void) | undefined>;
}) {
  const { overlayMode, setOverlayMode, selectionState, setSelectionState, inputSetterRef } = params;

  const [quickSlashBuffer, setQuickSlashBuffer] = useState<string | null>(null);
  const selectionBackupRef = useRef<SelectionState>(null);
  const prevOverlayModeRef = useRef<OverlayModeType>(overlayMode);
  const launcherConfirmedRef = useRef<boolean>(false);

  // Prefill the input when quickSlashBuffer changes
  useEffect(() => {
    if (quickSlashBuffer != null) {
      const timer = setTimeout(() => {
        try {
          inputSetterRef.current?.(quickSlashBuffer);
        } catch {
          // ignore
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [quickSlashBuffer, inputSetterRef]);

  // Restore original selection if temporary overlays were cancelled
  useEffect(() => {
    const prev = prevOverlayModeRef.current;

    if (
      prev === "launcher" &&
      overlayMode === "none" &&
      selectionBackupRef.current &&
      !launcherConfirmedRef.current
    ) {
      try {
        setSelectionState(selectionBackupRef.current);
        setOverlayMode("selection");
      } finally {
        selectionBackupRef.current = null;
        setQuickSlashBuffer(null);
      }
    }

    if (
      prev === "selection" &&
      overlayMode === "none" &&
      selectionBackupRef.current &&
      quickSlashBuffer != null
    ) {
      try {
        setSelectionState(selectionBackupRef.current);
        setOverlayMode("selection");
      } finally {
        selectionBackupRef.current = null;
        setQuickSlashBuffer(null);
      }
    }

    if (prev === "launcher" && overlayMode !== "launcher") {
      launcherConfirmedRef.current = false;
    }

    prevOverlayModeRef.current = overlayMode;
  }, [overlayMode, setOverlayMode, setSelectionState, quickSlashBuffer]);

  const confirmLauncher = () => {
    launcherConfirmedRef.current = true;
  };

  const backupSelectionIfNeeded = () => {
    if (selectionState && !selectionBackupRef.current) {
      selectionBackupRef.current = selectionState;
    }
  };

  return {
    quickSlashBuffer,
    setQuickSlashBuffer,
    selectionBackupRef,
    confirmLauncher,
    backupSelectionIfNeeded,
  } as const;
}


