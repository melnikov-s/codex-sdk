import type { OverlayModeType } from "./types";
import type { ApprovalPolicy } from "../../approvals.js";
import type { UIMessage } from "../../utils/ai.js";
import type {
  Workflow,
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

export function OverlayRouter(props: {
  overlayMode: OverlayModeType;
  setOverlayMode: (m: OverlayModeType) => void;
  items: Array<UIMessage>;
  approvalPolicy: ApprovalPolicy;
  onSelectApproval: (newMode: ApprovalPolicy) => void;
  selectionState: SelectionState;
  promptState: PromptState;
  confirmationState: ConfirmationState;
  workflow?: Workflow | null;
}) {
  const {
    overlayMode,
    setOverlayMode,
    items,
    approvalPolicy,
    onSelectApproval,
    selectionState,
    promptState,
    confirmationState,
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
        isActive={overlayMode === "selection"}
      />
    );
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
          isActive={overlayMode === "confirmation"}
        />
      </Box>
    );
  }

  return null;
}
