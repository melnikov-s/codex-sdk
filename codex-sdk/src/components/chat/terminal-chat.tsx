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
import type { ModelMessage } from "ai";
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

  const [items, setItems] = useState<Array<UIMessage>>([]);

  // New workflow state management
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    loading: false,
    messages: [],
    inputDisabled: false,
    queue: [],
    statusLine: undefined,
    slots: undefined,
  });

  // Separate synchronous state for immediate getState access
  const syncStateRef = useRef<WorkflowState>({
    loading: false,
    messages: [],
    inputDisabled: false,
    queue: [],
    statusLine: undefined,
    slots: undefined,
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
        // Top-level shallow merge
        const baseMerged = { ...syncStateRef.current, ...updater } as WorkflowState;
        // Nested object shallow-merge for object-valued fields (exclude arrays and React elements)
        const isMergableObject = (value: unknown): value is Record<string, unknown> => {
          return (
            value != null &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            // exclude React elements which carry $$typeof
            !(value as { $$typeof?: unknown }).$$typeof
          );
        };
        // For each provided key, if both prev and next are mergable objects, shallow-merge them
        const prevState = syncStateRef.current as unknown as Record<string, unknown>;
        const upd = updater as Record<string, unknown>;
        for (const key of Object.keys(upd)) {
          const prevVal = prevState[key];
          const nextVal = upd[key];
          if (isMergableObject(prevVal) && isMergableObject(nextVal)) {
            (baseMerged as unknown as Record<string, unknown>)[key] = {
              ...(prevVal as Record<string, unknown>),
              ...(nextVal as Record<string, unknown>),
            };
          }
        }
        newState = baseMerged;
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
  }, [workflowState.loading]);

  useEffect(() => {
    setItems(workflowState.messages);
    setInputDisabled(workflowState.inputDisabled);
  }, [workflowState.messages, workflowState.inputDisabled]);

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
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig | undefined>(
    undefined,
  );

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
      inputSchema: ShellToolParametersSchema,
    });

    const applyPatchTool = tool({
      description: `Use \`apply_patch\` to edit files: {"cmd":["apply_patch","*** Begin Patch\\n*** Update File: path/to/file.py\\n@@ def example():\\n-  pass\\n+  return 123\\n*** End Patch"]}.`,
      inputSchema: ShellToolParametersSchema,
    });

    // User interaction tool - handles confirmations, prompts, and selections
    const userSelectTool = tool({
      description:
        "Show user a selection of options. Can be used for confirmations (Yes/No), prompted input (with suggestions + custom option), or pure selections. Automatically includes 'None of the above' option which allows user to provide custom input instead.",
      inputSchema: z.object({
        message: z.string().describe("Selection prompt to show the user"),
        options: z
          .array(z.string())
          .describe("Array of option strings for user to choose from"),
        defaultValue: z
          .string()
          .describe(
            "Value to use if user doesn't respond in time (must match one of the options)",
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
        get statusLine() {
          return syncStateRef.current.statusLine;
        },
        get slots() {
          return syncStateRef.current.slots;
        },
      },
      addMessage: (message: UIMessage | Array<UIMessage>) => {
        const messages = Array.isArray(message) ? message : [message];
        void smartSetState((prev) => ({
          ...prev,
          messages: [...prev.messages, ...messages],
        }));
      },
      pushQueue: (item: string | Array<string>) => {
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
      shiftQueue: () => {
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
      handleToolCall: (async (
        messageOrMessages: ModelMessage | Array<ModelMessage>,
        { abortSignal } = {},
      ) => {
        // Support single message or array of messages
        const messages = Array.isArray(messageOrMessages)
          ? messageOrMessages
          : [messageOrMessages];

        const toolResponses: Array<ModelMessage> = [];

        for (const message of messages) {
          const toolCall = getToolCall(message);
          if (!toolCall || !isNativeTool(toolCall.toolName)) {
            continue;
          }

          // Handle user interaction tools
          if (toolCall.toolName === "user_select") {
            const {
              message: promptMessage,
              options,
              defaultValue,
            } = toolCall.input as {
              message: string;
              options: Array<string>;
              defaultValue: string;
            };

            // Transform string options to objects (using string as both label and key)
            const transformedOptions = options.map((option) => ({
              label: option,
              value: option, // Same as label, but needed for Select component structure
            }));

            // Auto-add "None of the above" option
            const CUSTOM_INPUT_VALUE = "__CUSTOM_INPUT__";
            const enhancedOptions = [
              ...transformedOptions,
              {
                label: "None of the above (enter custom option)",
                value: CUSTOM_INPUT_VALUE,
              },
            ];

            // Ensure defaultValue exists in the original options (not custom input)
            const originalOptions = transformedOptions; // The options without "None of the above"
            const validDefaultValue = originalOptions.find(
              (opt) => opt.value === defaultValue,
            )
              ? defaultValue
              : (originalOptions[0]?.value ?? "yes"); // Fallback to first original option, not custom input

            const userResponse = await new Promise<string>(
              (resolve, reject) => {
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
              },
            );

            // Build tool response message and collect it
            toolResponses.push({
              role: "tool" as const,
              content: [
                {
                  type: "tool-result" as const,
                  toolCallId: toolCall.toolCallId,
                  output: {
                    value: userResponse,
                    type: "text",
                  },
                  toolName: toolCall.toolName,
                },
              ],
            });
            continue;
          }

          // Handle the tool call with existing system (shell/apply_patch)
          const toolResults = await execToolCall(
            getToolCall(message)!,
            uiConfig,
            approvalPolicy,
            additionalWritableRoots,
            getCommandConfirmation,
            abortSignal,
          );
          if (toolResults[0]) {
            toolResponses.push(toolResults[0]);
          }
        }

        // Return single or array depending on input shape
        if (Array.isArray(messageOrMessages)) {
          return toolResponses; // possibly empty
        }
        return toolResponses[0] || null;
      }) as WorkflowHooks["handleToolCall"],

      handleModelResult: async (result, opts) => {
        const messages = result?.response?.messages ?? [];
        const msgsAsUI = messages as unknown as Array<UIMessage>;
        workflowHooks.addMessage(msgsAsUI);
        const toolResponses = (await workflowHooks.handleToolCall(
          messages as unknown as Array<ModelMessage>,
          opts,
        )) as Array<ModelMessage>;
        workflowHooks.addMessage(toolResponses as unknown as Array<UIMessage>);
        return toolResponses as unknown as Array<UIMessage>;
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
              workflowHeader:
                displayConfig?.header || "Codex (Default workflow)",
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
            />
            {/* Slot below input */}
            {workflowState.slots?.belowInput ?? null}
          </Box>
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
