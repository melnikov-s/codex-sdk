import type { ApplyPatchCommand, ApprovalPolicy } from "../../approvals.js";
import type { LibraryConfig } from "../../lib.js";
import type { CommandConfirmation } from "../../utils/agent/review.js";
import type { UIMessage } from "../../utils/ai.js";
import type {
  Workflow,
  WorkflowFactory,
  WorkflowHooks,
  SelectItem,
  SelectOptions,
  SelectOptionsWithTimeout,
  WorkflowState,
  ConfirmOptions,
  ConfirmOptionsWithTimeout,
  PromptOptions,
  DisplayConfig,
  PromptOptionsWithTimeout,
} from "../../workflow";
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
import { extractAppliedPatches as _extractAppliedPatches } from "../../utils/extract-applied-patches.js";
import { log } from "../../utils/logger/log.js";
import { CLI_VERSION } from "../../utils/session.js";
import { shortCwd } from "../../utils/short-path.js";
import { defaultWorkflow } from "../../workflow/default-agent.js";
import ApprovalModeOverlay from "../approval-mode-overlay.js";
import HelpOverlay from "../help-overlay.js";
import HistoryOverlay from "../history-overlay.js";
import PromptOverlay from "../prompt-overlay.js";
// Model overlay removed - model selection is handled by consumer's workflow
import { tool } from "ai";
import { Box, Text } from "ink";
import { spawn } from "node:child_process";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { inspect } from "util";
import { z } from "zod";

export type OverlayModeType =
  | "none"
  | "history"
  | "approval"
  | "help"
  | "selection"
  | "prompt"
  | "confirmation";

type Props = {
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
  const [items, setItems] = useState<Array<UIMessage>>([]);

  // New workflow state management
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    loading: false,
    messages: [],
    inputDisabled: false,
    queue: [],
  });

  // Separate synchronous state for immediate getState access
  const syncStateRef = useRef<WorkflowState>({
    loading: false,
    messages: [],
    inputDisabled: false,
    queue: [],
  });

  // Smart setState that updates both sync state immediately and React state for UI
  const smartSetState = useCallback(
    async (
      updater:
        | Partial<WorkflowState>
        | ((prev: WorkflowState) => WorkflowState),
    ): Promise<void> => {
      // Update synchronous state immediately
      let newState: WorkflowState;
      if (typeof updater === "function") {
        newState = updater(syncStateRef.current);
      } else {
        newState = { ...syncStateRef.current, ...updater };
      }
      syncStateRef.current = newState;

      // Also update React state for UI rendering
      setWorkflowState(newState);

      // Return immediately resolved promise since state is synchronously updated
      return Promise.resolve();
    },
    [],
  );

  // Sync workflowState to individual state pieces for backward compatibility
  useEffect(() => {
    setLoading(workflowState.loading);
    setItems(workflowState.messages);
    setInputDisabled(workflowState.inputDisabled);
  }, [workflowState]);

  const {
    requestConfirmation,
    confirmationPrompt,
    explanation,
    submitConfirmation,
  } = useConfirmation();
  const [overlayMode, setOverlayMode] = useState<OverlayModeType>("none");

  // Selection state for onSelect hook
  const [selectionState, setSelectionState] = useState<{
    items: Array<SelectItem>;
    options?: SelectOptions | SelectOptionsWithTimeout;
    resolve: (value: string) => void;
    reject: (reason?: Error) => void;
  } | null>(null);

  // Prompt state for onPromptUser hook
  const [promptState, setPromptState] = useState<{
    message: string;
    options?: PromptOptions | PromptOptionsWithTimeout;
    resolve: (value: string) => void;
    reject: (reason?: Error) => void;
  } | null>(null);

  // Confirmation state for onConfirm hook
  const [confirmationState, setConfirmationState] = useState<{
    message: string;
    options?: ConfirmOptions | ConfirmOptionsWithTimeout;
    resolve: (value: boolean) => void;
    reject: (reason?: Error) => void;
  } | null>(null);

  // Input disabled state for workflows to control input availability
  const [inputDisabled, setInputDisabled] = useState<boolean>(false);

  const PWD = React.useMemo(() => shortCwd(), []);

  // Workflow reference
  const workflowRef = React.useRef<Workflow | null>(null);
  const [, forceUpdate] = React.useReducer((c) => c + 1, 0); // trigger re‑render

  // Store displayConfig from workflow
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig | undefined>(undefined);

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
  const getCommandConfirmation = useCallback(
    async (
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
    },
    [requestConfirmation],
  );

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

    const ShellToolParametersSchema = z.object({
      cmd: z
        .array(z.string())
        .describe("The command and its arguments to execute."),
      workdir: z.string().describe("The working directory for the command."),
      timeout: z
        .number()
        .describe(
          "The maximum time to wait for the command to complete in milliseconds.",
        ),
    });

    // Vercel AI SDK compatible tool definition
    const shellTool = tool({
      description: `Run a command in the terminal, can be git or shell, or any other command available on the system.`,
      parameters: ShellToolParametersSchema,
    });

    const applyPatchTool = tool({
      description: `Use \`apply_patch\` to edit files: {"cmd":["apply_patch","*** Begin Patch\\n*** Update File: path/to/file.py\\n@@ def example():\\n-  pass\\n+  return 123\\n*** End Patch"]}.`,
      parameters: ShellToolParametersSchema,
    });

    // User interaction tool - handles confirmations, prompts, and selections
    const userSelectTool = tool({
      description:
        "Show user a selection of options. Can be used for confirmations (Yes/No), prompted input (with suggestions + custom option), or pure selections. Automatically includes 'None of the above' option which allows user to provide custom input instead.",
      parameters: z.object({
        message: z.string().describe("Selection prompt to show the user"),
        options: z
          .array(
            z.object({
              label: z.string().describe("Display text for this option"),
              value: z
                .string()
                .describe("Value returned if this option is selected"),
            }),
          )
          .describe("Array of options for user to choose from"),
        defaultValue: z
          .string()
          .describe(
            "Value to use if user doesn't respond in time (must match one of the option values)",
          ),
      }),
    });

    // Create the workflow hooks
    const workflowHooks: WorkflowHooks = {
      tools: {
        shell: shellTool,
        apply_patch: applyPatchTool,
        user_select: userSelectTool,
      },
      logger: (message) => {
        log(message);
      },
      setState: smartSetState,
      state: {
        get loading() {
          return syncStateRef.current.loading;
        },
        get messages() {
          return syncStateRef.current.messages;
        },
        get inputDisabled() {
          return syncStateRef.current.inputDisabled;
        },
        get queue() {
          return syncStateRef.current.queue || [];
        },
        get transcript() {
          return syncStateRef.current.messages.filter(
            (msg) => msg.role !== "ui",
          );
        },
      },
      appendMessage: (message: UIMessage | Array<UIMessage>) => {
        const messages = Array.isArray(message) ? message : [message];
        void smartSetState((prev) => ({
          ...prev,
          messages: [...prev.messages, ...messages],
        }));
      },
      addToQueue: (item: string | Array<string>) => {
        const items = Array.isArray(item) ? item : [item];
        // Convert any non-string items to strings
        const stringItems = items.map((i) => {
          if (typeof i === "string") {
            return i;
          } else if (typeof i === "object" && i && "content" in i) {
            // Handle message objects by extracting content
            return (i as { content: string }).content;
          } else if (typeof i === "object" && i && "text" in i) {
            // Handle objects with text property
            return (i as { text: string }).text;
          } else {
            // Convert anything else to string
            return String(i);
          }
        });
        void smartSetState((prev) => ({
          ...prev,
          queue: [...(prev.queue || []), ...stringItems],
        }));
      },
      unshiftQueue: () => {
        const currentState = syncStateRef.current;
        const queue = currentState.queue || [];
        if (queue.length === 0) {
          return undefined;
        }
        const firstItem = queue[0];
        void smartSetState((prev) => ({
          ...prev,
          queue: (prev.queue || []).slice(1),
        }));
        return firstItem;
      },
      onError: (error) => {
        log(`Workflow error: ${(error as Error).message}`);
        // Error is already handled in the workflow's run method
      },
      onConfirm: async (
        msg: string,
        options?: ConfirmOptions | ConfirmOptionsWithTimeout,
      ) => {
        // Show confirmation dialog using ephemeral UI
        return new Promise<boolean>((resolve, reject) => {
          setConfirmationState({
            message: msg,
            options,
            resolve,
            reject,
          });
          setOverlayMode("confirmation");
        });
      },
      onPrompt: async (
        msg: string,
        options?: PromptOptions | PromptOptionsWithTimeout,
      ) => {
        // Show text input prompt
        return new Promise<string>((resolve, reject) => {
          setPromptState({
            message: msg,
            options,
            resolve,
            reject,
          });
          setOverlayMode("prompt");
        });
      },
      onSelect: (
        items: Array<SelectItem>,
        options?: SelectOptions | SelectOptionsWithTimeout,
      ) => {
        return new Promise<string>((resolve, reject) => {
          setSelectionState({ items, options, resolve, reject });
          setOverlayMode("selection");
        });
      },
      handleToolCall: async (message, { abortSignal } = {}) => {
        // Extract the tool call from the message
        const toolCall = getToolCall(message);
        if (!toolCall || !isNativeTool(toolCall.toolName)) {
          return null;
        }

        // Handle user interaction tools
        if (toolCall.toolName === "user_select") {
          const {
            message: promptMessage,
            options,
            defaultValue,
          } = toolCall.args as {
            message: string;
            options: Array<{ label: string; value: string }>;
            defaultValue: string;
          };

          // Auto-add "None of the above" option
          const CUSTOM_INPUT_VALUE = "__CUSTOM_INPUT__";
          const enhancedOptions = [
            ...options,
            {
              label: "None of the above (enter custom option)",
              value: CUSTOM_INPUT_VALUE,
            },
          ];

          // Ensure defaultValue exists in the original options (not custom input)
          const originalOptions = options; // The options without "None of the above"
          const validDefaultValue = originalOptions.find(
            (opt) => opt.value === defaultValue,
          )
            ? defaultValue
            : (originalOptions[0]?.value ?? "yes"); // Fallback to first original option, not custom input

          const userResponse = await new Promise<string>((resolve, reject) => {
            setSelectionState({
              items: enhancedOptions,
              options: {
                label: promptMessage,
                timeout: 45, // Always 45 seconds
                defaultValue: validDefaultValue, // This is now always a valid string
              },
              resolve,
              reject,
            });
            setOverlayMode("selection");
          });

          // Otherwise return normal tool response
          return {
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId: toolCall.toolCallId,
                result: JSON.stringify({
                  output: userResponse,
                  metadata: {
                    exit_code: 0,
                    duration_seconds: 0,
                  },
                }),
                toolName: toolCall.toolName,
              },
            ],
          };
        }

        // Handle the tool call with existing system (shell/apply_patch)
        const toolResults = await execToolCall(
          toolCall,
          uiConfig,
          approvalPolicy,
          additionalWritableRoots,
          getCommandConfirmation,
          abortSignal,
        );

        // Return the first tool result or null if none
        return toolResults[0] || null;
      },
    };

    // Create the workflow using the provided factory or default
    const factory = workflowFactory || defaultWorkflow;
    workflowRef.current = factory(workflowHooks);

    // Store displayConfig from workflow (not workflowHooks)
    setDisplayConfig(workflowRef.current?.displayConfig);

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
  }, [
    approvalPolicy,
    notify,
    requestConfirmation,
    uiConfig,
    workflowFactory,
    additionalWritableRoots,
    smartSetState,
    confirmationPrompt,
    getCommandConfirmation,
  ]);

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
            displayConfig={displayConfig}
            headerProps={{
              terminalRows,
              version: CLI_VERSION,
              PWD,
              approvalPolicy,
              colorsByPolicy,
              headers,
              statusLine,
              workflowHeader: displayConfig?.header || "Codex (Default workflow)",
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
            queue={workflowState.queue || []}
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
            openOverlay={() => setOverlayMode("history")}
            openApprovalOverlay={() => setOverlayMode("approval")}
            openHelpOverlay={() => setOverlayMode("help")}
            workflow={workflowRef.current}
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
              setApprovalPolicy(newMode as ApprovalPolicy);
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

        {overlayMode === "prompt" && promptState && (
          <PromptOverlay
            message={promptState.message}
            options={promptState.options}
            onSubmit={(value: string) => {
              promptState.resolve(value);
              setPromptState(null);
              setOverlayMode("none");
            }}
            onCancel={() => {
              promptState.reject(new Error("Prompt cancelled"));
              setPromptState(null);
              setOverlayMode("none");
            }}
          />
        )}

        {overlayMode === "confirmation" && confirmationState && (
          <Box flexDirection="column">
            <Text>{confirmationState.message}</Text>
            <TerminalChatSelect
              items={[
                { label: "Yes", value: "yes" },
                { label: "No", value: "no" },
              ]}
              options={
                confirmationState.options &&
                "timeout" in confirmationState.options &&
                "defaultValue" in confirmationState.options
                  ? {
                      required: true,
                      default: "no",
                      timeout: confirmationState.options.timeout,
                      defaultValue: confirmationState.options.defaultValue
                        ? "yes"
                        : "no",
                    }
                  : { required: true, default: "no" }
              }
              onSelect={(value: string) => {
                confirmationState.resolve(value === "yes");
                setConfirmationState(null);
                setOverlayMode("none");
              }}
              onCancel={() => {
                confirmationState.resolve(false); // Default to false on cancel
                setConfirmationState(null);
                setOverlayMode("none");
              }}
              isActive={overlayMode === "confirmation"}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
