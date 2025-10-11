import type {
  ApplyPatchCommand,
  ApprovalPolicy,
  SafetyAssessment,
} from "../approvals.js";
import type { LibraryConfig } from "../lib.js";
import type { CommandConfirmation } from "../utils/agent/review.js";
import type { UIMessage, MessageMetadata } from "../utils/ai.js";
import type {
  ConfirmOptions,
  ConfirmOptionsWithTimeout,
  PromptOptions,
  PromptOptionsWithTimeout,
  SelectItem,
  SelectOptions,
  SelectOptionsWithTimeout,
  Workflow,
  WorkflowController,
  WorkflowFactory,
  WorkflowHooks,
  WorkflowState,
} from "../workflow/index.js";
import type { ModelMessage, ToolCallPart, ToolSet } from "ai";

import { canAutoApprove } from "../approvals.js";
import {
  createApplyPatchTool,
  createShellTool,
} from "../components/chat/tools/definitions.js";
import { execToolCall } from "../tools/runtime.js";
import { ReviewDecision } from "../utils/agent/review.js";
import {
  getId,
  getMessageType,
  getTextContent,
  getToolCalls,
} from "../utils/ai.js";
import { filterTranscript } from "../utils/workflow/message.js";
import { appendItems, shift } from "../utils/workflow/queue.js";
import { coerceTaskItems, toggleTaskAtIndex } from "../utils/workflow/tasks.js";

export type HeadlessOptions = {
  approvalPolicy?: ApprovalPolicy;
  additionalWritableRoots?: ReadonlyArray<string>;
  fullStdout?: boolean;
  config?: LibraryConfig;
  format?: {
    roleHeader?: (msg: UIMessage) => string;
    message?: (msg: UIMessage) => string;
  };
  log?: { sink?: (line: string) => void; mode?: "human" | "jsonl" };
};

function createStateGetters(syncRef: { current: WorkflowState }) {
  return {
    get loading() {
      return syncRef.current.loading;
    },
    get messages() {
      return syncRef.current.messages;
    },
    get inputDisabled() {
      return syncRef.current.inputDisabled;
    },
    get queue() {
      return syncRef.current.queue || [];
    },
    get taskList() {
      return syncRef.current.taskList || [];
    },
    get transcript() {
      const all = syncRef.current.messages || [];
      const topLevel = all.filter((m) => {
        const meta = (m as UIMessage).metadata as
          | { agentId?: string }
          | undefined;
        return m.role !== "ui" && !meta?.agentId;
      });
      return filterTranscript(topLevel as Array<UIMessage>);
    },
    get statusLine() {
      return syncRef.current.statusLine;
    },
    get slots() {
      return syncRef.current.slots;
    },
    get approvalPolicy() {
      return syncRef.current.approvalPolicy;
    },
  } as WorkflowHooks["state"];
}

function defaultRoleHeader(msg: UIMessage): string {
  switch (msg.role) {
    case "user":
      return "[user]";
    case "assistant":
      return "[assistant]";
    case "tool": {
      if (Array.isArray(msg.content)) {
        const part = msg.content.find(
          (p) => (p as { type?: string } | undefined)?.type === "tool-result",
        ) as { toolName?: string } | undefined;
        const name = part?.toolName || "unknown";
        return `[tool:${name}]`;
      }
      return "[tool]";
    }
    case "ui":
      return "[ui]";
    default:
      return `[${(msg as { role?: string }).role ?? "message"}]`;
  }
}

function defaultMessageFormatter(msg: UIMessage): string {
  // Skip empty reasoning-only chunks
  const type = getMessageType(msg);
  if (type === "reasoning") {
    const text = getTextContent(msg).trim();
    if (text.length === 0) {
      return "";
    }
  }
  const content = getTextContent(msg);
  return content;
}

function humanFormatLine(
  msg: UIMessage,
  roleHeader: (m: UIMessage) => string,
  message: (m: UIMessage) => string,
): string | null {
  const header = roleHeader(msg);
  const body = message(msg);
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return `${header} ${trimmed}`;
}

function jsonlFormatLine(msg: UIMessage): string {
  // A minimal durable record per message
  const record: { role: string; text: string } = {
    role: (msg as { role: string }).role,
    text: getTextContent(msg),
  };
  return JSON.stringify(record);
}

export function runHeadless(
  workflowFactory: WorkflowFactory,
  options: HeadlessOptions = {},
): WorkflowController {
  const approvalPolicy: ApprovalPolicy = options.approvalPolicy ?? "suggest";
  const additionalWritableRoots: ReadonlyArray<string> =
    options.additionalWritableRoots ?? [];
  const config: LibraryConfig = options.config || {};

  const seenIds = new Set<string>();
  const sink =
    options.log?.sink ?? ((line: string) => process.stdout.write(line + "\n"));
  const mode = options.log?.mode ?? "human";
  const roleHeader = options.format?.roleHeader ?? defaultRoleHeader;
  const messageFmt = options.format?.message ?? defaultMessageFormatter;

  let state: WorkflowState = {
    loading: false,
    messages: [],
    inputDisabled: false,
    queue: [],
    taskList: [],
    statusLine: undefined,
    slots: undefined,
    agentNames: {},
    approvalPolicy,
  };
  const syncRef = { current: state };

  const printNewMessages = (messages: Array<UIMessage>) => {
    for (const msg of messages) {
      const id = getId(msg);
      if (seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      const line =
        mode === "jsonl"
          ? jsonlFormatLine(msg)
          : humanFormatLine(msg, roleHeader, messageFmt);
      if (line != null) {
        sink(line);
      }
    }
  };

  const smartSetState: WorkflowHooks["setState"] = async (updater) => {
    let newState: WorkflowState;
    if (typeof updater === "function") {
      newState = (updater as (prev: WorkflowState) => WorkflowState)(
        syncRef.current,
      );
    } else {
      newState = {
        ...(syncRef.current as object),
        ...(updater as object),
      } as WorkflowState;
    }
    syncRef.current = newState;
    state = newState;
    // On each commit, print messages we haven't seen yet
    printNewMessages(newState.messages || []);
    return Promise.resolve();
  };

  const getCommandConfirmation = async (
    _command: Array<string>,
    _applyPatch: ApplyPatchCommand | undefined,
  ): Promise<CommandConfirmation> => {
    return { review: ReviewDecision.NO_CONTINUE };
  };

  const executeTools = async (
    messageOrMessages: ModelMessage | Array<ModelMessage>,
    { abortSignal }: { abortSignal?: AbortSignal } = {},
  ): Promise<ModelMessage | Array<ModelMessage> | null> => {
    const messages = Array.isArray(messageOrMessages)
      ? messageOrMessages
      : [messageOrMessages];

    const toolResponses: Array<ModelMessage> = [];
    for (const message of messages) {
      const parts = getToolCalls(message) as Array<ToolCallPart>;
      for (const toolCall of parts) {
        // Ignore any non-native tools and explicitly exclude user_select in headless
        const name: string | undefined = toolCall.toolName;
        if (name !== "shell" && name !== "apply_patch") {
          continue;
        }

        const results = await execToolCall(
          toolCall,
          config,
          syncRef.current.approvalPolicy ?? approvalPolicy,
          additionalWritableRoots,
          getCommandConfirmation,
          abortSignal,
        );
        if (results[0]) {
          toolResponses.push(results[0]);
        }
      }
    }

    if (Array.isArray(messageOrMessages)) {
      return toolResponses;
    }
    return toolResponses[0] || null;
  };

  const stateGetters = createStateGetters(syncRef);

  const actions: WorkflowHooks["actions"] = {
    say: (text: string, metadata?: MessageMetadata) => {
      const message = { role: "ui", content: text, metadata } as UIMessage;
      void smartSetState((prev) => ({
        ...prev,
        messages: [...prev.messages, message],
      }));
    },
    addMessage: (message: UIMessage | Array<UIMessage>) => {
      const messages = Array.isArray(message) ? message : [message];
      void smartSetState((prev) => ({
        ...prev,
        messages: [...prev.messages, ...messages],
      }));
    },
    setLoading: (loading: boolean) => void smartSetState({ loading }),
    setInputDisabled: (disabled: boolean) =>
      void smartSetState({ inputDisabled: disabled }),
    setStatusLine: (content) => void smartSetState({ statusLine: content }),
    setSlot: (region, content) =>
      void smartSetState((prev) => ({
        ...prev,
        slots: { ...(prev.slots || {}), [region]: content },
      })),
    clearSlot: (region) =>
      void smartSetState((prev) => {
        const slots = { ...(prev.slots || {}) } as NonNullable<
          WorkflowState["slots"]
        >;
        delete (slots as Record<string, unknown>)[region as string];
        return { ...prev, slots } as WorkflowState;
      }),
    clearAllSlots: () => void smartSetState((prev) => ({ ...prev, slots: {} })),
    addToQueue: (item: string | Array<string>) =>
      void smartSetState((prev) => ({
        ...prev,
        queue: appendItems(
          prev.queue || [],
          Array.isArray(item) ? item : [item],
        ),
      })),
    removeFromQueue: () => {
      const { first, rest } = shift(syncRef.current.queue || []);
      void smartSetState((prev) => ({ ...prev, queue: rest }));
      return first;
    },
    clearQueue: () => void smartSetState((prev) => ({ ...prev, queue: [] })),
    addTask: (task) =>
      void smartSetState((prev) => ({
        ...prev,
        taskList: coerceTaskItems(task),
      })),
    toggleTask: (index?: number) =>
      void smartSetState((prev) => ({
        ...prev,
        taskList:
          index == null
            ? prev.taskList || []
            : toggleTaskAtIndex(prev.taskList || [], index),
      })),
    clearTaskList: () =>
      void smartSetState((prev) => ({ ...prev, taskList: [] })),
    setApprovalPolicy: (policy: ApprovalPolicy) => {
      void smartSetState({ approvalPolicy: policy });
    },
    setInputValue: (_value: string) => {
      // No-op in headless mode - there's no input UI to set
    },
    truncateFromLastMessage: (role: UIMessage["role"]): Array<UIMessage> => {
      const messages = [...(syncRef.current.messages || [])];

      // Find the last message with the specified role
      let targetIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === role) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex === -1) {
        return []; // No message found
      }

      // Get the messages to remove (from target index to end)
      const messagesToRemove = messages.slice(targetIndex);

      // Update state to remove messages
      void smartSetState((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, targetIndex),
      }));

      return messagesToRemove;
    },
    handleModelResult: async (result, opts) => {
      const messages = result?.response?.messages ?? [];
      actions.addMessage(messages as unknown as Array<UIMessage>);
      const toolResponses = (await executeTools(
        messages as unknown as Array<ModelMessage>,
        opts,
      )) as Array<ModelMessage>;
      actions.addMessage(toolResponses as unknown as Array<UIMessage>);
      return toolResponses as unknown as Array<UIMessage>;
    },
    createAgent: (name: string) => {
      const agents =
        (runHeadless as unknown as { _agents?: Map<string, string> })._agents ||
        new Map<string, string>();
      (runHeadless as unknown as { _agents?: Map<string, string> })._agents =
        agents;

      const id = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const effectiveName = name;
      agents.set(id, effectiveName);
      void smartSetState((prev) => ({
        ...prev,
        agentNames: { ...(prev.agentNames || {}), [id]: effectiveName },
      }));

      const tag = (m: UIMessage): UIMessage => ({
        ...m,
        agentId: id,
      });

      const say = (text: string, metadata?: MessageMetadata) => {
        const msg = tag({ role: "ui", content: text, metadata } as UIMessage);
        void smartSetState((prev) => ({
          ...prev,
          messages: [...prev.messages, msg],
        }));
      };

      const addMessage = (message: UIMessage | Array<UIMessage>) => {
        const list = Array.isArray(message) ? message : [message];
        const tagged = list.map(tag);
        void smartSetState((prev) => ({
          ...prev,
          messages: [...prev.messages, ...tagged],
        }));
      };

      const computeTranscript = (): Array<ModelMessage> => {
        const all = syncRef.current.messages || [];
        const mine = all.filter(
          (m) => m.role !== "ui" && (m as UIMessage).agentId === id,
        );
        return filterTranscript(mine as Array<UIMessage>);
      };

      const handleModelResults = async (
        result: {
          response: { messages: Array<ModelMessage> };
          finishReason?: string;
        },
        opts?: { abortSignal?: AbortSignal },
      ): Promise<Array<UIMessage>> => {
        const assistantMsgs = result?.response?.messages ?? [];
        addMessage(assistantMsgs as unknown as Array<UIMessage>);
        const toolResponses = (await executeTools(
          assistantMsgs,
          opts,
        )) as Array<ModelMessage>;
        addMessage(toolResponses as unknown as Array<UIMessage>);
        return (toolResponses as unknown as Array<UIMessage>) || [];
      };

      const setName = (newName: string) => {
        agents.set(id, newName);
        void smartSetState((prev) => ({
          ...prev,
          agentNames: { ...(prev.agentNames || {}), [id]: newName },
        }));
      };

      return {
        id,
        name: effectiveName,
        say,
        addMessage,
        get transcript() {
          return computeTranscript();
        },
        handleModelResults,
        setName,
        get tools() {
          return hooks.tools;
        },
      } as const;
    },
    getAgent: (id: string) => {
      const agents = (
        runHeadless as unknown as { _agents?: Map<string, string> }
      )._agents;
      if (!agents) {
        return undefined as unknown as ReturnType<
          NonNullable<WorkflowHooks["actions"]["getAgent"]>
        >;
      }
      const name = agents.get(id);
      if (!name) {
        return undefined as unknown as ReturnType<
          NonNullable<WorkflowHooks["actions"]["getAgent"]>
        >;
      }
      // Recreate a fresh handle bound to current closures
      const handle = (
        actions.createAgent as (
          p: string,
        ) => ReturnType<NonNullable<WorkflowHooks["actions"]["createAgent"]>>
      )(name);
      // override generated id with looked up id for a stable handle
      return { ...handle, id };
    },
  };

  const hooks: WorkflowHooks = {
    headless: true,
    setState: smartSetState,
    state: stateGetters,
    actions,
    control: {
      message: (input: string | ModelMessage) => {
        const normalized: ModelMessage =
          typeof input === "string" ? { role: "user", content: input } : input;
        workflow.message(normalized);
      },
      stop: () => workflow.stop(),
      terminate: () => workflow.terminate(),
    },
    tools: {
      // Only native tools excluding user_select
      definitions: {
        shell: createShellTool(),
        apply_patch: createApplyPatchTool(),
      } as unknown as ToolSet,
      execute: executeTools as WorkflowHooks["tools"]["execute"],
    },
    prompts: {
      select: (
        _items: Array<SelectItem>,
        options: SelectOptions | SelectOptionsWithTimeout,
      ): Promise<string> => Promise.resolve(options.defaultValue),
      confirm: (
        _message: string,
        options: ConfirmOptions | ConfirmOptionsWithTimeout,
      ): Promise<boolean> => Promise.resolve(options.defaultValue),
      input: (
        _message: string,
        options: PromptOptions | PromptOptionsWithTimeout,
      ): Promise<string> => Promise.resolve(options.defaultValue),
    },
    approval: {
      getPolicy: () => syncRef.current.approvalPolicy ?? approvalPolicy,
      setPolicy: (policy: ApprovalPolicy) =>
        void smartSetState({ approvalPolicy: policy }),
      canAutoApprove: async (
        command: ReadonlyArray<string>,
        workdir?: string,
        writableRoots?: ReadonlyArray<string>,
      ): Promise<SafetyAssessment> => {
        const current = syncRef.current.approvalPolicy ?? approvalPolicy;
        return canAutoApprove(
          command,
          workdir,
          current,
          writableRoots || additionalWritableRoots,
          config.safeCommands || [],
        );
      },
    },
  } as WorkflowHooks;

  const workflow = (
    workflowFactory ||
    ((_hooks: WorkflowHooks) =>
      ({
        initialize() {},
        message() {},
        stop() {},
        terminate() {},
      }) as unknown as Workflow)
  )(hooks);

  workflow.initialize?.();

  const controller: WorkflowController = {
    headless: true,
    message: (input: string | ModelMessage) => {
      const normalized: ModelMessage =
        typeof input === "string" ? { role: "user", content: input } : input;
      workflow.message(normalized);
    },
    stop: () => workflow.stop(),
    terminate: (_code?: number) => workflow.terminate(),
    getState: () => syncRef.current,
    setState: smartSetState,
  };

  return controller;
}
