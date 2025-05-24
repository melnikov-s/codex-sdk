import type { ApplyPatchCommand, ApprovalPolicy } from "../../approvals.js";
import type { LibraryConfig } from "../../lib.js";
import type { CommandConfirmation } from "../../utils/agent/review.js";
import type {
  Workflow,
  WorkflowFactory,
  WorkflowHooks,
  SelectItem,
  SelectOptions,
} from "../../workflow";
import type { CoreMessage } from "ai";
import type { ColorName } from "chalk";

import TerminalChatInput from "./terminal-chat-input.js";
import { TerminalChatSelect } from "./terminal-chat-select.js";
import { TerminalChatToolCallCommand } from "./terminal-chat-tool-call-command.js";
import TerminalMessageHistory from "./terminal-message-history.js";
import { formatCommandForDisplay } from "../../format-command.js";
import { useConfirmation } from "../../hooks/use-confirmation.js";
import { useTerminalSize } from "../../hooks/use-terminal-size.js";
import { execToolCall } from "../../tools/runtime.js";
import { ReviewDecision } from "../../utils/agent/review.js";
import { getToolCall, isNativeTool, getTextContent } from "../../utils/ai.js";
// Import removed - compact summary is now handled by consumer's workflow
import { extractAppliedPatches as _extractAppliedPatches } from "../../utils/extract-applied-patches.js";
import { getGitDiff } from "../../utils/get-diff.js";
import { createInputItem } from "../../utils/input-utils.js";
import { log } from "../../utils/logger/log.js";
import { CLI_VERSION } from "../../utils/session.js";
import { shortCwd } from "../../utils/short-path.js";
import { saveRollout } from "../../utils/storage/save-rollout.js";
import { defaultWorkflow } from "../../workflow/default-agent.js";
import ApprovalModeOverlay from "../approval-mode-overlay.js";
import DiffOverlay from "../diff-overlay.js";
import HelpOverlay from "../help-overlay.js";
import HistoryOverlay from "../history-overlay.js";
// Model overlay removed - model selection is handled by consumer's workflow
import { Box, Text } from "ink";
import { spawn } from "node:child_process";
import React, { useEffect, useRef, useState } from "react";
import { inspect } from "util";

export type OverlayModeType =
  | "none"
  | "history"
  | "approval"
  | "help"
  | "diff"
  | "selection";

type Props = {
  prompt?: string;
  imagePaths?: Array<string>;
  approvalPolicy: ApprovalPolicy;
  additionalWritableRoots: ReadonlyArray<string>;
  fullStdout: boolean;
  workflowFactory?: WorkflowFactory;
  uiConfig?: LibraryConfig;
};

const colorsByPolicy: Record<ApprovalPolicy, ColorName | undefined> = {
  "suggest": undefined,
  "auto-edit": "greenBright",
  "full-auto": "green",
};

// Command explanation functionality removed - should be handled by the consumer's workflow

export default function TerminalChat({
  prompt: _initialPrompt,
  imagePaths: _initialImagePaths,
  approvalPolicy: initialApprovalPolicy,
  additionalWritableRoots,
  fullStdout,
  workflowFactory,
  uiConfig = {}, // Default to empty object if not provided
}: Props): React.ReactElement {
  const notify = Boolean(uiConfig?.notify);
  // Model state removed - model selection is now handled by consumer's workflow
  const [loading, setLoading] = useState<boolean>(false);
  const [approvalPolicy, setApprovalPolicy] = useState<ApprovalPolicy>(
    initialApprovalPolicy,
  );
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [items, setItems] = useState<Array<CoreMessage>>([]);

  // Handle workflow commands
  const _handleWorkflowCommand = async (command: string, args?: string) => {
    const workflow = workflowRef.current;
    if (workflow?.commands?.[command]) {
      try {
        await workflow.commands[command].handler(args);
      } catch (error) {
        setItems((prev) => [
          ...prev,
          {
            role: "system",
            content: `Error executing /${command}: ${(error as Error).message}`,
          },
        ]);
      }
    } else {
      setItems((prev) => [
        ...prev,
        {
          role: "system",
          content: `Command /${command} is not available in the current workflow.`,
        },
      ]);
    }
  };

  const {
    requestConfirmation,
    confirmationPrompt,
    explanation,
    submitConfirmation,
  } = useConfirmation();
  const [overlayMode, setOverlayMode] = useState<OverlayModeType>("none");

  // Store the diff text when opening the diff overlay so the view isn't
  // recomputed on every re‑render while it is open.
  // diffText is passed down to the DiffOverlay component. The setter is
  // currently unused but retained for potential future updates. Prefix with
  // an underscore so eslint ignores the unused variable.
  const [diffText, _setDiffText] = useState<string>("");

  const [initialPrompt, setInitialPrompt] = useState(_initialPrompt);
  const [initialImagePaths, setInitialImagePaths] =
    useState(_initialImagePaths);

  // Selection state for onSelect hook
  const [selectionState, setSelectionState] = useState<{
    items: Array<SelectItem>;
    options?: SelectOptions;
    resolve: (value: string) => void;
    reject: (reason?: Error) => void;
  } | null>(null);

  // Input disabled state for workflows to control input availability
  const [inputDisabled, setInputDisabled] = useState<boolean>(false);

  const PWD = React.useMemo(() => shortCwd(), []);

  // Workflow reference
  const workflowRef = React.useRef<Workflow | null>(null);
  const [, forceUpdate] = React.useReducer((c) => c + 1, 0); // trigger re‑render

  // ────────────────────────────────────────────────────────────────
  // DEBUG: log every render w/ key bits of state
  // ────────────────────────────────────────────────────────────────
  log(
    `render - workflow? ${Boolean(workflowRef.current)} loading=${loading} items=${
      items.length
    }`,
  );

  // MCP functionality removed - now handled by consumer's workflow

  // Command confirmation handler for the workflow
  const getCommandConfirmation = async (
    command: Array<string>,
    applyPatch: ApplyPatchCommand | undefined,
  ): Promise<CommandConfirmation> => {
    log(`getCommandConfirmation: ${command}`);
    const commandForDisplay = formatCommandForDisplay(command);

    // First request for confirmation
    let { decision: review, customDenyMessage } = await requestConfirmation(
      <TerminalChatToolCallCommand commandForDisplay={commandForDisplay} />,
    );

    // If the user wants an explanation, inform them this needs to be handled by the consumer's workflow
    if (review === ReviewDecision.EXPLAIN) {
      log(`Command explanation requested for: ${commandForDisplay}`);
      // Simple fallback explanation since consumers should implement their own explanation
      const explanation =
        "Command explanation is now handled by the consumer's workflow implementation.";
      log(`Using fallback explanation: ${explanation}`);

      // Ask for confirmation again with basic information
      const confirmResult = await requestConfirmation(
        <TerminalChatToolCallCommand
          commandForDisplay={commandForDisplay}
          explanation={explanation}
        />,
      );

      // Update the decision based on the second confirmation.
      review = confirmResult.decision;
      customDenyMessage = confirmResult.customDenyMessage;

      // Return the final decision with the explanation.
      return { review, customDenyMessage, applyPatch, explanation };
    }

    return { review, customDenyMessage, applyPatch };
  };

  useEffect(() => {
    // Skip recreating the workflow if awaiting a decision on a pending confirmation.
    if (confirmationPrompt != null) {
      log("skip workflow recreation due to pending confirmationPrompt");
      return;
    }

    log("creating NEW workflow");
    log(`approvalPolicy=${approvalPolicy}`);

    // Tear down any existing workflow before creating a new one.
    workflowRef.current?.terminate();

    const sessionId = crypto.randomUUID();

    // Create the workflow hooks
    const workflowHooks: WorkflowHooks = {
      tools: {},
      toolPrompt: "",
      logger: (message) => {
        log(message);
      },
      onMessage: (item) => {
        log(`onMessage: ${JSON.stringify(item)}`);
        setItems((prev) => {
          const updated = [...prev, item];
          saveRollout(sessionId, updated);
          return updated;
        });
      },
      onSystemMessage: (feedback) => {
        log(`onSystemMessage: ${feedback}`);
        // Potentially add to a different part of the UI or handle differently
        // For now, just logging it similar to other debug messages.
      },
      setLoading,
      onError: (error) => {
        log(`Workflow error: ${(error as Error).message}`);
        // Error is already handled in the workflow's run method
      },
      confirm: async (_msg: string) => {
        // Simple confirmation implementation
        return true;
      },
      onCommandExecuted: (command: string, result?: string) => {
        log(`Command executed: ${command}${result ? ` - ${result}` : ""}`);
        if (result) {
          setItems((prev) => [
            ...prev,
            {
              role: "system",
              content: result,
            },
          ]);
        }
      },
      onSelect: (items: Array<SelectItem>, options?: SelectOptions) => {
        return new Promise<string>((resolve, reject) => {
          setSelectionState({ items, options, resolve, reject });
          setOverlayMode("selection");
        });
      },
      setInputDisabled: (disabled: boolean) => {
        setInputDisabled(disabled);
      },
      handleToolCall: async (message) => {
        // Extract the tool call from the message
        const toolCall = getToolCall(message);
        if (!toolCall || !isNativeTool(toolCall.toolName)) {
          return null;
        }

        // Create an abort controller for this tool call
        const abortController = new AbortController();

        // Handle the tool call
        const toolResults = await execToolCall(
          toolCall,
          uiConfig,
          approvalPolicy,
          additionalWritableRoots,
          getCommandConfirmation,
          abortController.signal,
        );

        // Return the first tool result or null if none
        return toolResults[0] || null;
      },
    };

    // Create the workflow using the provided factory or default
    const factory = workflowFactory || defaultWorkflow;
    workflowRef.current = factory(workflowHooks);

    // Initialize the workflow
    workflowRef.current.initialize?.();

    // Force a render so JSX below can "see" the freshly created workflow.
    forceUpdate();

    log(`Workflow created: ${inspect(workflowRef.current, { depth: 1 })}`);

    return () => {
      // Clean up any workflows.
      workflowRef.current?.terminate();
      workflowRef.current = null;
      forceUpdate(); // re‑render after teardown too
    };
    // We intentionally omit 'approvalPolicy' and 'confirmationPrompt' from the deps
    // so switching modes or showing confirmation dialogs doesn't tear down the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiConfig, requestConfirmation, additionalWritableRoots]);

  // Whenever loading starts/stops, reset or start a timer — but pause the
  // timer while a confirmation overlay is displayed so we don't trigger a
  // re‑render every second during apply_patch reviews.
  useEffect(() => {
    let handle: ReturnType<typeof setInterval> | null = null;
    // Only tick the "thinking…" timer when the agent is actually processing
    // a request *and* the user is not being asked to review a command.
    if (loading && confirmationPrompt == null) {
      setThinkingSeconds(0);
      handle = setInterval(() => {
        setThinkingSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (handle) {
        clearInterval(handle);
      }
      setThinkingSeconds(0);
    }
    return () => {
      if (handle) {
        clearInterval(handle);
      }
    };
  }, [loading, confirmationPrompt]);

  // Notify desktop with a preview when an assistant response arrives.
  const prevLoadingRef = useRef<boolean>(false);
  useEffect(() => {
    // Only notify when notifications are enabled.
    if (!notify) {
      prevLoadingRef.current = loading;
      return;
    }

    if (
      prevLoadingRef.current &&
      !loading &&
      confirmationPrompt == null &&
      items.length > 0
    ) {
      if (process.platform === "darwin") {
        // find the last assistant message
        const assistantMessages = items.filter((i) => i.role === "assistant");
        const last = assistantMessages[assistantMessages.length - 1];
        if (last) {
          const text = getTextContent(last);
          const preview = text.replace(/\n/g, " ").slice(0, 100);
          const safePreview = preview.replace(/"/g, '\\"');
          const title = "Codex CLI";
          const cwd = PWD;
          spawn("osascript", [
            "-e",
            `display notification "${safePreview}" with title "${title}" subtitle "${cwd}" sound name "Ping"`,
          ]);
        }
      }
    }
    prevLoadingRef.current = loading;
  }, [notify, loading, confirmationPrompt, items, PWD]);

  // Let's also track whenever the ref becomes available.
  const workflow = workflowRef.current;
  useEffect(() => {
    log(`workflowRef.current is now ${Boolean(workflow)}`);
  }, [workflow]);

  // ---------------------------------------------------------------------
  // Dynamic layout constraints – keep total rendered rows <= terminal rows
  // ---------------------------------------------------------------------

  const { rows: terminalRows } = useTerminalSize();

  useEffect(() => {
    const processInitialInputItems = async () => {
      if (
        (!initialPrompt || initialPrompt.trim() === "") &&
        (!initialImagePaths || initialImagePaths.length === 0)
      ) {
        return;
      }
      const inputItems = [
        await createInputItem(initialPrompt || "", initialImagePaths || []),
      ];
      // Clear them to prevent subsequent runs.
      setInitialPrompt("");
      setInitialImagePaths([]);
      if (workflow != null) {
        workflow.run(inputItems);
      }
    };
    processInitialInputItems();
  }, [workflow, initialPrompt, initialImagePaths]);

  // Just render every item in order, no grouping/collapse.
  const lastMessageBatch = items.map((item) => ({ item }));
  const groupCounts: Record<string, number> = {};
  const userMsgCount = items.filter((i) => i.role === "user").length;

  // Get headers from config - either static array or function result
  const headers = React.useMemo(() => {
    const configHeaders = uiConfig?.headers;
    if (!configHeaders) {
      return [];
    }
    return typeof configHeaders === "function"
      ? configHeaders()
      : configHeaders;
  }, [uiConfig?.headers]);

  // Get status line from config - either static string or function result
  const statusLine = React.useMemo(() => {
    const configStatusLine = uiConfig?.statusLine;
    if (!configStatusLine) {
      return "";
    }
    return typeof configStatusLine === "function"
      ? configStatusLine()
      : configStatusLine;
  }, [uiConfig?.statusLine]);

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
            thinkingSeconds={thinkingSeconds}
            fullStdout={fullStdout}
            headerProps={{
              terminalRows,
              version: CLI_VERSION,
              PWD,
              approvalPolicy,
              colorsByPolicy,
              initialImagePaths,
              headers,
              statusLine,
            }}
          />
        ) : (
          <Box>
            <Text color="gray">Initializing workflow…</Text>
          </Box>
        )}
        {overlayMode === "none" && workflow && (
          <TerminalChatInput
            loading={loading}
            setItems={setItems}
            isNew={workflowRef.current != null && items.length === 0}
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
            openOverlay={() => setOverlayMode("history")}
            openApprovalOverlay={() => setOverlayMode("approval")}
            openHelpOverlay={() => setOverlayMode("help")}
            openDiffOverlay={() => {
              const { isGitRepo, diff } = getGitDiff();
              let text: string;
              if (isGitRepo) {
                text = diff;
              } else {
                text = "`/diff` — _not inside a git repository_";
              }
              setItems((prev) => [
                ...prev,
                {
                  id: `diff-${Date.now()}`,
                  type: "message",
                  role: "system",
                  content: text,
                },
              ]);
              // Ensure no overlay is shown.
              setOverlayMode("none");
            }}
            workflow={workflowRef.current}
            active={overlayMode === "none" && !inputDisabled}
            interruptAgent={() => {
              if (!workflow) {
                return;
              }
              log(
                "TerminalChat: interruptAgent invoked – calling workflow.stop()",
              );
              workflow.stop();
              setLoading(false);

              // Add a system message to indicate the interruption
              setItems((prev) => [
                ...prev,
                {
                  id: `interrupt-${Date.now()}`,
                  role: "system",
                  content:
                    "⏹️  Execution interrupted by user. You can continue typing.",
                },
              ]);
            }}
            submitInput={(inputs) => {
              setItems((prev) => [...prev, ...inputs]);
              if (workflow != null) {
                workflow.run(inputs);
              }
              return {};
            }}
            items={items}
            thinkingSeconds={thinkingSeconds}
          />
        )}
        {overlayMode === "history" && (
          <HistoryOverlay items={items} onExit={() => setOverlayMode("none")} />
        )}
        {/* Model overlay removed - model is now handled by consumer's workflow */}
        {overlayMode === "approval" && (
          <ApprovalModeOverlay
            currentMode={approvalPolicy}
            onSelect={(newMode) => {
              // Update approval policy without cancelling an in-progress session.
              if (newMode === approvalPolicy) {
                return;
              }

              setApprovalPolicy(newMode as ApprovalPolicy);
              // We can't dynamically update the approval policy with the new workflow architecture
              // We'll recreate the workflow with the new approval policy when needed
              setItems((prev) => [
                ...prev,
                {
                  id: `switch-approval-${Date.now()}`,
                  role: "system",
                  content: `Switched approval mode to ${newMode}`,
                },
              ]);

              setOverlayMode("none");
            }}
            onExit={() => setOverlayMode("none")}
          />
        )}

        {overlayMode === "help" && (
          <HelpOverlay
            onExit={() => setOverlayMode("none")}
            workflow={workflowRef.current}
          />
        )}

        {overlayMode === "diff" && (
          <DiffOverlay
            diffText={diffText}
            onExit={() => setOverlayMode("none")}
          />
        )}

        {overlayMode === "selection" && selectionState && (
          <TerminalChatSelect
            items={selectionState.items}
            options={selectionState.options}
            onSelect={(value: string) => {
              selectionState.resolve(value);
              setSelectionState(null);
              setOverlayMode("none");
            }}
            onCancel={() => {
              selectionState.reject(new Error("Selection cancelled"));
              setSelectionState(null);
              setOverlayMode("none");
            }}
            isActive={overlayMode === "selection"}
          />
        )}
      </Box>
    </Box>
  );
}
