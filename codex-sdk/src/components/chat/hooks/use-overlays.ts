import type {
  SelectItem,
  SelectOptions,
  SelectOptionsWithTimeout,
  PromptOptions,
  PromptOptionsWithTimeout,
  ConfirmOptions,
  ConfirmOptionsWithTimeout,
  WorkflowInfo,
} from "../../../workflow";
import type { OverlayModeType } from "../types";

import { useCallback, useState } from "react";

export type SelectionState = {
  items: Array<SelectItem>;
  options?: SelectOptions | SelectOptionsWithTimeout;
  resolve: (value: string) => void;
  reject: (reason?: Error) => void;
} | null;

export type PromptState = {
  message: string;
  options?: PromptOptions | PromptOptionsWithTimeout;
  resolve: (value: string) => void;
  reject: (reason?: Error) => void;
} | null;

export type ConfirmationState = {
  message: string;
  options?: ConfirmOptions | ConfirmOptionsWithTimeout;
  resolve: (value: boolean) => void;
  reject: (reason?: Error) => void;
} | null;

export type WorkflowPickerState = {
  workflows: Array<WorkflowInfo>;
  activeWorkflowId: string;
  onSelectWorkflow: (workflowId: string) => void;
  onCreateNew?: () => void;
} | null;

export function useOverlays() {
  const [overlayMode, setOverlayMode] = useState<OverlayModeType>("none");

  const [selectionState, setSelectionState] = useState<SelectionState>(null);
  const [promptState, setPromptState] = useState<PromptState>(null);
  const [confirmationState, setConfirmationState] =
    useState<ConfirmationState>(null);
  const [workflowPickerState, setWorkflowPickerState] = 
    useState<WorkflowPickerState>(null);

  const openSelection = useCallback(
    (
      items: Array<SelectItem>,
      options?: SelectOptions | SelectOptionsWithTimeout,
    ) =>
      new Promise<string>((resolve, reject) => {
        setSelectionState({ items, options, resolve, reject });
        setOverlayMode("selection");
      }),
    [],
  );

  const openPrompt = useCallback(
    (message: string, options?: PromptOptions | PromptOptionsWithTimeout) =>
      new Promise<string>((resolve, reject) => {
        setPromptState({ message, options, resolve, reject });
        setOverlayMode("prompt");
      }),
    [],
  );

  const openConfirmation = useCallback(
    (message: string, options?: ConfirmOptions | ConfirmOptionsWithTimeout) =>
      new Promise<boolean>((resolve, reject) => {
        setConfirmationState({ message, options, resolve, reject });
        setOverlayMode("confirmation");
      }),
    [],
  );

  const closeSelection = useCallback(() => {
    setSelectionState(null);
    setOverlayMode("none");
  }, []);

  const closePrompt = useCallback(() => {
    setPromptState(null);
    setOverlayMode("none");
  }, []);

  const closeConfirmation = useCallback(() => {
    setConfirmationState(null);
    setOverlayMode("none");
  }, []);

  const openWorkflowPicker = useCallback((
    workflows: Array<WorkflowInfo>,
    activeWorkflowId: string,
    onSelectWorkflow: (workflowId: string) => void,
    onCreateNew?: () => void
  ) => {
    setWorkflowPickerState({
      workflows,
      activeWorkflowId,
      onSelectWorkflow,
      onCreateNew,
    });
    setOverlayMode("workflow-picker");
  }, []);

  const closeWorkflowPicker = useCallback(() => {
    setWorkflowPickerState(null);
    setOverlayMode("none");
  }, []);

  return {
    overlayMode,
    setOverlayMode,
    selectionState,
    setSelectionState,
    promptState,
    setPromptState,
    confirmationState,
    setConfirmationState,
    workflowPickerState,
    setWorkflowPickerState,
    openSelection,
    openPrompt,
    openConfirmation,
    openWorkflowPicker,
    closeSelection,
    closePrompt,
    closeConfirmation,
    closeWorkflowPicker,
  } as const;
}
