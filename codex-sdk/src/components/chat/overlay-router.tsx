import type { OverlayModeType } from "./types";
import type { ApprovalPolicy } from "../../approvals.js";
import type { UIMessage } from "../../utils/ai.js";
import type {
  Workflow,
  WorkflowInfo,
  SelectItem,
  SelectOptions,
  SelectOptionsWithTimeout,
  ConfirmOptions,
  ConfirmOptionsWithTimeout,
  PromptOptions,
  PromptOptionsWithTimeout,
} from "../../workflow";

import { TerminalChatSelect } from "./terminal-chat-select.js";
import ApprovalModeOverlay from "../approval-mode-overlay.js";
import HelpOverlay from "../help-overlay.js";
import HistoryOverlay from "../history-overlay.js";
import PromptOverlay from "../prompt-overlay.js";
import { Box, Text } from "ink";
import React from "react";

type SelectionState = {
  items: Array<SelectItem>;
  options?: SelectOptions | SelectOptionsWithTimeout;
  resolve: (value: string) => void;
  reject: (reason?: Error) => void;
} | null;

type PromptState = {
  message: string;
  options?: PromptOptions | PromptOptionsWithTimeout;
  resolve: (value: string) => void;
  reject: (reason?: Error) => void;
} | null;

type ConfirmationState = {
  message: string;
  options?: ConfirmOptions | ConfirmOptionsWithTimeout;
  resolve: (value: boolean) => void;
  reject: (reason?: Error) => void;
} | null;

type WorkflowPickerState = {
  workflows: Array<WorkflowInfo>;
  activeWorkflowId: string;
  onSelectWorkflow: (workflowId: string) => void;
  onCreateNew?: () => void;
} | null;

export function OverlayRouter(props: {
  overlayMode: OverlayModeType;
  setOverlayMode: (m: OverlayModeType) => void;
  items: Array<UIMessage>;
  approvalPolicy: ApprovalPolicy;
  onSelectApproval: (newMode: ApprovalPolicy) => void;
  selectionState: SelectionState;
  // When true, selection UI is temporarily hidden (slash input takes over) but state remains pending
  selectionSuppressed?: boolean;
  promptState: PromptState;
  confirmationState: ConfirmationState;
  workflowPickerState?: WorkflowPickerState;
  workflow?: Workflow | null;
  availableWorkflows?: Array<{ title: string; factory: unknown }>;
  onCreateFromLauncher?: (factory: unknown) => void;
}) {
  const {
    overlayMode,
    setOverlayMode,
    items,
    approvalPolicy,
    onSelectApproval,
    selectionState,
    selectionSuppressed,
    promptState,
    confirmationState,
    workflowPickerState,
    workflow,
  } = props;

  if (overlayMode === "history") {
    return (
      <HistoryOverlay items={items} onExit={() => setOverlayMode("none")} />
    );
  }

  if (overlayMode === "approval") {
    return (
      <ApprovalModeOverlay
        currentMode={approvalPolicy}
        onSelect={(newMode) => {
          onSelectApproval(newMode as ApprovalPolicy);
          setOverlayMode("none");
        }}
        onExit={() => setOverlayMode("none")}
      />
    );
  }

  if (overlayMode === "help") {
    // Parent should provide workflow if needed. We only route.
    return (
      <HelpOverlay onExit={() => setOverlayMode("none")} workflow={workflow} />
    );
  }

  if (overlayMode === "selection" && selectionState) {
    if (selectionSuppressed) {
      // Keep selection promise alive but hide the UI while slash command input is active
      return null;
    }
    return (
      <TerminalChatSelect
        items={selectionState.items}
        options={selectionState.options}
        onSelect={(value: string) => {
          selectionState.resolve(value);
          setOverlayMode("none");
        }}
        onCancel={() => {
          selectionState.reject(new Error("Selection cancelled"));
          setOverlayMode("none");
        }}
        onSlashModeRequested={() => {
          // Hide the selection overlay and show the input
          setOverlayMode("none");
        }}
        isActive={overlayMode === "selection"}
      />
    );
  }

  // Suppress launcher overlay while slash-mode is active
  if (overlayMode === "launcher" && selectionSuppressed) {
    return null;
  }

  if (overlayMode === "prompt" && promptState) {
    return (
      <PromptOverlay
        message={promptState.message}
        options={promptState.options}
        onSubmit={(value: string) => {
          promptState.resolve(value);
          setOverlayMode("none");
        }}
        onCancel={() => {
          promptState.reject(new Error("Prompt cancelled"));
          setOverlayMode("none");
        }}
      />
    );
  }

  if (overlayMode === "confirmation" && confirmationState) {
    return (
      <Box flexDirection="column">
        <Text>{confirmationState.message}</Text>
        <TerminalChatSelect
          items={[
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]}
          options={{ required: true, defaultValue: "no" }}
          onSelect={(value: string) => {
            confirmationState.resolve(value === "yes");
            setOverlayMode("none");
          }}
          onCancel={() => {
            confirmationState.resolve(false);
            setOverlayMode("none");
          }}
          onSlashModeRequested={() => {
            // Hide the confirmation and show input
            setOverlayMode("none");
          }}
          isActive={overlayMode === "confirmation"}
        />
      </Box>
    );
  }

  if (overlayMode === "workflow-picker" && workflowPickerState) {
    const items = [
      ...workflowPickerState.workflows.map((w) => ({
        label: `${w.isActive ? "▶ " : ""}${w.title}`,
        value: w.id,
      })),
      ...(workflowPickerState.onCreateNew
        ? [{ label: "Create New Workflow", value: "__create_new__" }]
        : []),
    ];
    const defaultValue =
      workflowPickerState.activeWorkflowId || items[0]?.value || "";
    return (
      <TerminalChatSelect
        items={items}
        options={{ defaultValue, label: "Switch workflow" }}
        onSelect={(value: string) => {
          if (value === "__create_new__") {
            workflowPickerState.onCreateNew?.();
          } else if (value) {
            workflowPickerState.onSelectWorkflow(value);
          }
          setOverlayMode("none");
        }}
        onCancel={() => setOverlayMode("none")}
        onSlashModeRequested={() => {
          // Hide the workflow picker and show input
          setOverlayMode("none");
        }}
        isActive={overlayMode === "workflow-picker"}
      />
    );
  }

  if (overlayMode === "launcher") {
    const list = (props.availableWorkflows || []) as Array<{ title: string; factory: unknown }>;
    const items = list.map((w, i) => ({ label: String(w.title), value: String(i) }));
    return (
      <TerminalChatSelect
        items={items}
        options={{ required: true, defaultValue: items[0]?.value || "0", label: "Create workflow" }}
        onSelect={(value: string) => {
          const idx = Number(value);
          const wf = list[idx] as { title: string; factory: unknown } | undefined;
          if (wf && 'factory' in wf) {
            props.onCreateFromLauncher?.(wf.factory);
          }
          setOverlayMode("none");
        }}
        onCancel={() => setOverlayMode("none")}
        onSlashModeRequested={() => {
          // Hide the launcher and show input
          setOverlayMode("none");
        }}
        isActive={overlayMode === "launcher"}
      />
    );
  }

  return null;
}
