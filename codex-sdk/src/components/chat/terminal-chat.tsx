import type { ApprovalPolicy } from "../../approvals.js";
import type { LibraryConfig } from "../../lib.js";
import type { ReviewDecision } from "../../utils/agent/review.js";
import type { UIMessage } from "../../utils/ai.js";
import type { WorkflowController, WorkflowFactory } from "../../workflow";
import type { ColorName } from "chalk";

import { useOverlays } from "./hooks/use-overlays.js";
import { useWorkflowManager } from "./hooks/use-workflow-manager.js";
import { OverlayRouter } from "./overlay-router.js";
import TerminalChatInput from "./terminal-chat-input.js";
import TerminalMessageHistory from "./terminal-message-history.js";
import { useDesktopNotifications } from "../../hooks/use-desktop-notifications.js";
import { useTerminalSize } from "../../hooks/use-terminal-size.js";
import { log } from "../../utils/logger/log.js";
import { CLI_VERSION } from "../../utils/session.js";
import { shortCwd } from "../../utils/short-path.js";
import { resolveHeaders, resolveStatusLine } from "../../utils/ui-config.js";
import { Box, Text } from "ink";
import React, { useEffect, useMemo, useCallback } from "react";

// OverlayModeType moved to ./types

type Props = {
  approvalPolicy: ApprovalPolicy;
  additionalWritableRoots: ReadonlyArray<string>;
  fullStdout: boolean;
  workflowFactory: WorkflowFactory;
  uiConfig?: LibraryConfig;
  onController?: (controller: WorkflowController) => void;
};

const colorsByPolicy: Record<ApprovalPolicy, ColorName | undefined> = {
  "suggest": undefined,
  "auto-edit": "greenBright",
  "full-auto": "green",
};

// Command explanation functionality removed - should be handled by the consumer's workflow

export default function TerminalChat({
  approvalPolicy: initialApprovalPolicy,
  additionalWritableRoots,
  fullStdout,
  workflowFactory,
  uiConfig,
  onController,
}: Props): React.ReactElement {
  const effectiveUiConfig = useMemo(() => uiConfig ?? {}, [uiConfig]);
  const notify = Boolean(effectiveUiConfig?.notify);
  const overlays = useOverlays();
  const { overlayMode, setOverlayMode, selectionState, setSelectionState, promptState, setPromptState, confirmationState, setConfirmationState } = overlays;

  const openSelectionStable = useCallback(
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

  const selectionApi = useMemo(
    () => ({
      openSelection: openSelectionStable,
      setOverlayMode: (mode: "selection" | "none") => setOverlayMode(mode),
    }),
    [openSelectionStable, setOverlayMode],
  );

  const openPromptStable = useCallback(
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

  const openConfirmationStable = useCallback(
    (message: string, options: { timeout?: number; defaultValue: boolean }) =>
      new Promise<boolean>((resolve) => {
        setConfirmationState({ message, options, resolve, reject: () => {} });
        setOverlayMode("confirmation");
      }),
    [setConfirmationState, setOverlayMode],
  );

  const promptApi = useMemo(
    () => ({
      openPrompt: openPromptStable,
      openConfirmation: openConfirmationStable,
    }),
    [openPromptStable, openConfirmationStable],
  );

  const workflowMgr = useWorkflowManager({
    initialApprovalPolicy,
    additionalWritableRoots,
    uiConfig: effectiveUiConfig,
    workflowFactory,
    onController,
    selectionApi,
    promptApi,
  });

  const loading = workflowMgr.state.loading;
  const items = workflowMgr.state.messages as Array<UIMessage>;
  const inputDisabled = Boolean(workflowMgr.state.inputDisabled);
  const approvalPolicy = workflowMgr.approvalPolicy;
  const workflowState = workflowMgr.state;
  const smartSetState = workflowMgr.smartSetState;
  const displayConfig = workflowMgr.displayConfig;
  const workflow = workflowMgr.workflow;
  const confirmationPrompt = workflowMgr.confirmationPrompt;
  const explanation = workflowMgr.explanation;
  const submitConfirmation = workflowMgr.submitConfirmation;
  const setApprovalPolicy = workflowMgr.setApprovalPolicy;

  const PWD = useMemo(() => shortCwd(), []);

  // ────────────────────────────────────────────────────────────────
  // DEBUG: log every render w/ key bits of state
  // ────────────────────────────────────────────────────────────────
  log(
    `render - workflow? ${Boolean(workflowMgr.workflow)} loading=${loading} items=${
      items.length
    }`,
  );

  // Workflow creation and lifecycle handled by hook

  useDesktopNotifications({ notify, loading, confirmationPrompt, items, cwd: PWD, title: (workflow?.title as string) || "Codex SDK" });

  // Let's also track whenever the ref becomes available.
  useEffect(() => {
    log(`workflowRef.current is now ${Boolean(workflow)}`);
  }, [workflow]);

  // ---------------------------------------------------------------------
  // Dynamic layout constraints – keep total rendered rows <= terminal rows
  // ---------------------------------------------------------------------

  const { rows: terminalRows } = useTerminalSize();

  // Just render every item in order, no grouping/collapse.
  const lastMessageBatch = items.map((item) => ({ item }));
  const groupCounts: Record<string, number> = {};
  const userMsgCount = items.filter((i) => i.role === "user").length;

  const headers = useMemo(() => resolveHeaders(effectiveUiConfig), [effectiveUiConfig]);
  const statusLine = useMemo(() => resolveStatusLine(effectiveUiConfig), [effectiveUiConfig]);

  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {workflow ? (
          <TerminalMessageHistory
            batch={lastMessageBatch}
            groupCounts={groupCounts}
            items={items}
            userMsgCount={userMsgCount}
            confirmationPrompt={confirmationPrompt}
            loading={loading}
            fullStdout={fullStdout}
            displayConfig={displayConfig}
            slots={workflowState.slots}
            headerProps={{
              terminalRows,
              version: CLI_VERSION,
              PWD,
              approvalPolicy,
              colorsByPolicy,
              headers,
              statusLine,
              workflowHeader: (workflow?.title as unknown as React.ReactNode) || displayConfig?.header || "Codex SDK",
            }}
          />
        ) : (
          <Box>
            <Text color="gray">Initializing workflow…</Text>
          </Box>
        )}
        {overlayMode === "none" && workflow && (
          <Box marginTop={2} flexDirection="column">
            {/* Slot above input */}
            {workflowState.slots?.aboveInput ?? null}
            <TerminalChatInput
            loading={loading}
            queue={workflowState.queue || []}
            taskList={workflowState.taskList || []}
            setItems={(updater) => {
              // Bridge setItems to smartSetState
              // TODO: Remove this when TerminalChatInput is refactored to use workflow directly
              smartSetState((prev) => ({
                ...prev,
                messages:
                  typeof updater === "function"
                    ? updater(prev.messages)
                    : updater,
              }));
            }}
            confirmationPrompt={confirmationPrompt}
            explanation={explanation}
            submitConfirmation={(
              decision: ReviewDecision,
              customDenyMessage?: string,
            ) =>
              submitConfirmation({
                decision,
                customDenyMessage,
              })
            }
            statusLine={statusLine}
            workflowStatusLine={workflowState.statusLine}
            openOverlay={() => setOverlayMode("history")}
            openApprovalOverlay={() => setOverlayMode("approval")}
            openHelpOverlay={() => setOverlayMode("help")}
            workflow={workflow}
            active={overlayMode === "none" && !inputDisabled}
            inputDisabled={inputDisabled}
            interruptAgent={() => {
              if (!workflow) {
                return;
              }
              log(
                "TerminalChat: interruptAgent invoked – calling workflow.stop()",
              );
              workflow.stop();
              // Let the workflow handle its own interruption state and messages
            }}
            submitInput={(input) => {
              if (workflow != null) {
                // Transform content array to simple string for user messages
                const transformedInput =
                  input.role === "user" && Array.isArray(input.content)
                    ? {
                        role: "user" as const,
                        content: input.content
                          .map((item) => {
                            if (typeof item === "string") {
                              return item;
                            }
                            if (
                              typeof item === "object" &&
                              item != null &&
                              "text" in item
                            ) {
                              return (item as { text: string }).text;
                            }
                            if (
                              typeof item === "object" &&
                              item != null &&
                              "content" in item
                            ) {
                              return (item as { content: string }).content;
                            }
                            return String(item);
                          })
                          .join(""),
                      }
                    : input;
                workflow.message(transformedInput);
              }
              return {};
            }}
            />
            {/* Slot below input */}
            {workflowState.slots?.belowInput ?? null}
          </Box>
        )}
        <OverlayRouter
          overlayMode={overlayMode}
          setOverlayMode={setOverlayMode}
          items={items}
          approvalPolicy={approvalPolicy}
          onSelectApproval={(newMode) => setApprovalPolicy(newMode)}
          selectionState={selectionState}
          promptState={promptState}
          confirmationState={confirmationState}
          workflow={workflow}
        />

        {/* selection overlay status line */}
        {overlayMode === "selection" && (workflowState.statusLine || statusLine) && (
          <Box flexDirection="column" marginTop={1}>
            {workflowState.statusLine && <Box marginBottom={0}>{workflowState.statusLine}</Box>}
            {statusLine && (
              <Box paddingX={2} marginBottom={1}>
                <Text dimColor>{statusLine}</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
