import type { SelectionState, PromptState, ConfirmationState } from "./use-overlays.js";
import type { OverlayModeType } from "../types.js";

import { useCallback, useMemo } from "react";

export function useOverlayAPIs(params: {
  setOverlayMode: (mode: OverlayModeType) => void;
  setSelectionState: (state: SelectionState) => void;
  setPromptState: (state: PromptState) => void;
  setConfirmationState: (state: ConfirmationState) => void;
}) {
  const { setOverlayMode, setSelectionState, setPromptState, setConfirmationState } = params;

  const openSelection = useCallback(
    (
      items: Array<{ label: string; value: string }>,
      options: { label?: string; timeout?: number; defaultValue: string },
    ) =>
      new Promise<string>((resolve, reject) => {
        setSelectionState({ items, options, resolve, reject });
        setOverlayMode("selection");
      }),
    [setSelectionState, setOverlayMode],
  );

  const openPrompt = useCallback(
    (
      message: string,
      options: { required?: boolean; defaultValue: string; timeout?: number },
    ) =>
      new Promise<string>((resolve, reject) => {
        setPromptState({ message, options, resolve, reject });
        setOverlayMode("prompt");
      }),
    [setPromptState, setOverlayMode],
  );

  const openConfirmation = useCallback(
    (message: string, options: { timeout?: number; defaultValue: boolean }) =>
      new Promise<boolean>((resolve) => {
        setConfirmationState({ message, options, resolve, reject: () => {} });
        setOverlayMode("confirmation");
      }),
    [setConfirmationState, setOverlayMode],
  );

  const selectionApi = useMemo(
    () => ({
      openSelection,
      setOverlayMode: (mode: "selection" | "none") => setOverlayMode(mode),
    }),
    [openSelection, setOverlayMode],
  );

  const promptApi = useMemo(
    () => ({ openPrompt, openConfirmation }),
    [openPrompt, openConfirmation],
  );

  return { openSelection, openPrompt, openConfirmation, selectionApi, promptApi } as const;
}


