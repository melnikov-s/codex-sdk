import type { SelectionState as OverlaySelectionState } from "./hooks/use-overlays.js";
import type { ReviewDecision } from "../../utils/agent/review.js";
import type { UIMessage } from "../../utils/ai.js";
import type { Workflow, WorkflowState } from "../../workflow";

import TerminalChatInput from "./terminal-chat-input.js";
import { log } from "../../utils/logger/log.js";
import { transformUserInput, type WorkflowInput } from "../../utils/transform-user-input.js";
import { Box } from "ink";
import React from "react";

type InstanceSummary = { id: string; title: string; isActive: boolean };

type Props = {
  overlayMode: string;
  quickSlashBuffer: string | null;
  setQuickSlashBuffer: (val: string | null) => void;
  workflowState: WorkflowState;
  workflow: Workflow | null | undefined;
  loading: boolean;
  statusLine: string;
  confirmationPrompt: React.ReactNode | null;
  explanation?: string;
  submitConfirmation: (args: { decision: ReviewDecision; customDenyMessage?: string }) => void;
  inputDisabled: boolean;
  inputSetterRef: React.MutableRefObject<((value: string) => void) | undefined>;
  smartSetState: (updater: (prev: WorkflowState) => WorkflowState) => void;
  // overlay controls
  setOverlayMode: (mode: string) => void;
  selectionState: OverlaySelectionState | null;
  setSelectionState: (state: OverlaySelectionState) => void;
  selectionBackupRef: React.MutableRefObject<OverlaySelectionState | null>;
  // selection opener
  openSelection: (
    items: Array<{ label: string; value: string }>,
    options: { label?: string; timeout?: number; defaultValue: string },
  ) => Promise<string>;
  // multi-workflow wiring
  multiWorkflow: boolean;
  listInstances: () => Array<InstanceSummary>;
  activeWorkflowId: string | null | undefined;
  switchToInstance: (id: string) => void;
  removeActiveGraceful: () => void;
  removeActiveForce: () => void;
};

export default function InputRegion(props: Props): React.ReactElement {
  const {
    overlayMode,
    quickSlashBuffer,
    setQuickSlashBuffer,
    workflowState,
    workflow,
    loading,
    statusLine,
    confirmationPrompt,
    explanation,
    submitConfirmation,
    inputDisabled,
    inputSetterRef,
    smartSetState,
    setOverlayMode,
    selectionState,
    setSelectionState,
    selectionBackupRef,
    openSelection,
    multiWorkflow,
    listInstances,
    activeWorkflowId,
    switchToInstance,
    removeActiveGraceful,
    removeActiveForce,
  } = props;

  const showContainer = (overlayMode === "none" || quickSlashBuffer != null) && Boolean(workflow) && (!multiWorkflow || listInstances().length > 0);

  if (!showContainer) {
    return <></>;
  }

  return (
    <Box
      marginTop={2}
      flexDirection="column"
      display={overlayMode !== "none" && quickSlashBuffer != null ? "none" : "flex"}
    >
      {workflowState.slots?.aboveInput ?? null}
      <TerminalChatInput
        loading={quickSlashBuffer != null ? false : loading}
        queue={workflowState.queue || []}
        taskList={workflowState.taskList || []}
        setItems={(updater: React.SetStateAction<Array<UIMessage>>) => {
          smartSetState((prev) => ({
            ...prev,
            messages: typeof updater === "function" ? (updater as (prev: Array<UIMessage>) => Array<UIMessage>)(prev.messages as Array<UIMessage>) : (updater as Array<UIMessage>),
          }));
        }}
        confirmationPrompt={confirmationPrompt}
        explanation={explanation}
        submitConfirmation={(decision: ReviewDecision, customDenyMessage?: string) =>
          submitConfirmation({ decision, customDenyMessage })
        }
        statusLine={statusLine}
        workflowStatusLine={workflowState.statusLine}
        openOverlay={() => setOverlayMode("history")}
        openApprovalOverlay={() => setOverlayMode("approval")}
        openHelpOverlay={() => setOverlayMode("help")}
        workflow={workflow as Workflow}
        active={(overlayMode === "none" || quickSlashBuffer != null) && !inputDisabled}
        inputDisabled={inputDisabled}
        inputSetterRef={inputSetterRef}
        onTextChange={(text: string) => {
          if (quickSlashBuffer != null) {
            if ((text === "" || !text.startsWith("/")) && overlayMode === "none") {
              if (selectionBackupRef.current) {
                setQuickSlashBuffer(null);
                try {
                  setSelectionState(selectionBackupRef.current);
                  setOverlayMode("selection");
                } finally {
                  selectionBackupRef.current = null;
                }
                return;
              }
              setQuickSlashBuffer(null);
            }
          } else {
            if (text.trim().startsWith("/")) {
              setQuickSlashBuffer("/");
            }
          }
        }}
        onSlashHandled={() => {
          // Intentionally no-op here; lifecycle handled by parent restoration logic
        }}
        switchWorkflowByQuery={(query?: string | null) => {
          if (!multiWorkflow) {
            return;
          }
          const q = (query || "").toLowerCase().trim();
          if (!q) {
            const instances = listInstances();
            if (instances.length === 0) {
              setOverlayMode("launcher");
              return;
            }
            const items = instances.map((i) => ({ label: `${i.isActive ? "▶ " : ""}${i.title}`, value: i.id }));
            if (selectionState && !selectionBackupRef.current) {
              selectionBackupRef.current = selectionState;
            }
            openSelection(items, {
              defaultValue: activeWorkflowId || (items[0]?.value ?? ""),
              label: "Switch workflow",
            })
              .then((id: string) => {
                switchToInstance(id);
                selectionBackupRef.current = null;
                setQuickSlashBuffer(null);
              })
              .catch(() => {
                if (selectionBackupRef.current) {
                  setSelectionState(selectionBackupRef.current);
                  setOverlayMode("selection");
                  selectionBackupRef.current = null;
                }
                setQuickSlashBuffer(null);
              });
            return;
          }
          const match = listInstances().find((w) => w.id.toLowerCase() === q || w.title.toLowerCase().includes(q));
          if (match) {
            switchToInstance(match.id);
          }
        }}
        openWorkflowPickerOverlay={() => {
          if (!multiWorkflow) {
            return;
          }
          const instances = listInstances();
          const items = instances.map((i) => ({ label: `${i.isActive ? "▶ " : ""}${i.title}`, value: i.id }));
          const withCreate = [...items, { label: "Create New Workflow", value: "__create_new__" }];
          if (selectionState && !selectionBackupRef.current) {
            selectionBackupRef.current = selectionState;
          }
          openSelection(withCreate, {
            defaultValue: activeWorkflowId || (items[0]?.value ?? ""),
            label: "Switch workflow",
          })
            .then((value: string) => {
              if (value === "__create_new__") {
                setOverlayMode("launcher");
                return;
              }
              if (value) {
                switchToInstance(value);
              }
              selectionBackupRef.current = null;
              setQuickSlashBuffer(null);
            })
            .catch(() => {
              if (selectionBackupRef.current) {
                setSelectionState(selectionBackupRef.current);
                setOverlayMode("selection");
                selectionBackupRef.current = null;
              }
              setQuickSlashBuffer(null);
            });
        }}
        openWorkflowLauncherOverlay={() => {
          if (selectionState && !selectionBackupRef.current) {
            selectionBackupRef.current = selectionState;
          }
          // Ensure launcher overlay is visible (not suppressed by slash-mode)
          setQuickSlashBuffer(null);
          setOverlayMode("launcher");
        }}
        closeCurrentWorkflow={() => {
          if (!multiWorkflow || !activeWorkflowId) {
            return;
          }
          removeActiveGraceful();
        }}
        killCurrentWorkflow={() => {
          if (!multiWorkflow || !activeWorkflowId) {
            return;
          }
          removeActiveForce();
        }}
        killCurrentOrExit={() => {
          if (multiWorkflow) {
            if (activeWorkflowId) {
              removeActiveForce();
            }
          } else {
            if (workflow) {
              workflow.stop();
            }
          }
        }}
        listTabs={() => {
          if (!multiWorkflow) {
            return;
          }
          const lines = listInstances().map((w, i) => `${i + 1}. ${w.title}${w.isActive ? " (active)" : ""}`);
          smartSetState((prev) => ({
            ...prev,
            messages: [
              ...((prev.messages as Array<UIMessage>) ?? []),
              {
                id: `tabs-${Date.now()}`,
                role: "system",
                content: lines.join("\n"),
                parts: [{ type: "text", text: lines.join("\n") }],
              } as UIMessage,
            ],
          }));
        }}
        goToNextWorkflow={() => {
          if (!multiWorkflow) {
            return;
          }
          const instances = listInstances();
          const currentIndex = instances.findIndex((w) => w.isActive);
          const nextIndex = (currentIndex + 1) % instances.length;
          if (instances[nextIndex]) {
            switchToInstance(instances[nextIndex].id);
          }
        }}
        goToPreviousWorkflow={() => {
          if (!multiWorkflow) {
            return;
          }
          const instances = listInstances();
          const currentIndex = instances.findIndex((w) => w.isActive);
          const prevIndex = (currentIndex - 1 + instances.length) % instances.length;
          if (instances[prevIndex]) {
            switchToInstance(instances[prevIndex].id);
          }
        }}
        interruptAgent={() => {
          if (!workflow) {
            return;
          }
          log("InputRegion: interruptAgent invoked – calling workflow.stop()");
          workflow.stop();
        }}
        submitInput={(input: WorkflowInput) => {
          if (workflow != null) {
            const transformed = transformUserInput(input) as WorkflowInput;
            workflow.message(transformed as unknown as never);
          }
          return {} as never;
        }}
      />
      {workflowState.slots?.belowInput ?? null}
    </Box>
  );
}


