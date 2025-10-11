import type { ApprovalPolicy } from "../../../approvals.js";
import type { UIMessage, MessageMetadata } from "../../../utils/ai.js";
import type { SlotRegion, TaskItem, WorkflowState } from "../../../workflow";
import type { ModelMessage } from "ai";
import type { ReactNode, MutableRefObject } from "react";

import { filterTranscript } from "../../../utils/workflow/message.js";
import { appendItems, shift } from "../../../utils/workflow/queue.js";
import {
  coerceTaskItems,
  toggleNextIncomplete,
  toggleTaskAtIndex,
} from "../../../utils/workflow/tasks.js";
import { useCallback, useMemo, useRef } from "react";

export function useWorkflowActions(params: {
  smartSetState: (
    updater: Partial<WorkflowState> | ((prev: WorkflowState) => WorkflowState),
  ) => Promise<void>;
  syncStateRef: MutableRefObject<WorkflowState>;
  setApprovalPolicy: (policy: ApprovalPolicy) => void;
  handleToolCall: (
    messageOrMessages: ModelMessage | Array<ModelMessage>,
    opts?: { abortSignal?: AbortSignal },
  ) => Promise<ModelMessage | Array<ModelMessage> | null>;
  inputSetterRef?: MutableRefObject<((value: string) => void) | undefined>;
}) {
  const {
    smartSetState,
    syncStateRef,
    setApprovalPolicy,
    handleToolCall,
    inputSetterRef,
  } = params;

  const say = useCallback(
    (text: string, metadata?: MessageMetadata) => {
      const message = { role: "ui", content: text, metadata } as UIMessage;
      void smartSetState((prev) => ({
        ...prev,
        messages: [...prev.messages, message],
      }));
    },
    [smartSetState],
  );

  const addMessage = useCallback(
    (message: UIMessage | Array<UIMessage>) => {
      const messages = Array.isArray(message) ? message : [message];
      void smartSetState((prev) => ({
        ...prev,
        messages: [...prev.messages, ...messages],
      }));
    },
    [smartSetState],
  );

  const setLoading = useCallback(
    (loading: boolean) => void smartSetState({ loading }),
    [smartSetState],
  );

  const setInputDisabled = useCallback(
    (disabled: boolean) => void smartSetState({ inputDisabled: disabled }),
    [smartSetState],
  );

  const setStatusLine = useCallback(
    (content: ReactNode) => void smartSetState({ statusLine: content }),
    [smartSetState],
  );

  const setSlot = useCallback(
    (region: SlotRegion, content: ReactNode | null) =>
      void smartSetState((prev) => ({
        ...prev,
        slots: { ...prev.slots, [region]: content },
      })),
    [smartSetState],
  );

  const clearSlot = useCallback(
    (region: SlotRegion) =>
      void smartSetState((prev) => ({
        ...prev,
        slots: { ...prev.slots, [region]: null },
      })),
    [smartSetState],
  );

  const clearAllSlots = useCallback(
    () => void smartSetState({ slots: {} }),
    [smartSetState],
  );

  const addToQueue = useCallback(
    (item: string | Array<string>) => {
      const items = Array.isArray(item) ? item : [item];
      void smartSetState((prev) => ({
        ...prev,
        queue: appendItems(prev.queue, items),
      }));
    },
    [smartSetState],
  );

  const removeFromQueue = useCallback(() => {
    const current = syncStateRef.current;
    const { first, rest } = shift(current.queue);
    void smartSetState((prev) => ({ ...prev, queue: rest }));
    return first;
  }, [smartSetState, syncStateRef]);

  const clearQueue = useCallback(
    () => void smartSetState({ queue: [] }),
    [smartSetState],
  );

  const addTask = useCallback(
    (task: string | TaskItem | Array<string | TaskItem>) =>
      void smartSetState((prev) => ({
        ...prev,
        taskList: [...(prev.taskList || []), ...coerceTaskItems(task)],
      })),
    [smartSetState],
  );

  const toggleTask = useCallback(
    (index?: number) =>
      void smartSetState((prev) => {
        const list = prev.taskList || [];
        const updated =
          index == null
            ? toggleNextIncomplete(list)
            : toggleTaskAtIndex(list, index);
        return { ...prev, taskList: updated };
      }),
    [smartSetState],
  );

  const clearTaskList = useCallback(
    () => void smartSetState({ taskList: [] }),
    [smartSetState],
  );

  const setApprovalPolicyAction = useCallback(
    (policy: ApprovalPolicy) => {
      setApprovalPolicy(policy);
      void smartSetState({ approvalPolicy: policy });
    },
    [setApprovalPolicy, smartSetState],
  );

  const setInputValue = useCallback(
    (value: string) => {
      try {
        inputSetterRef?.current?.(value);
      } catch {
        // no-op: ignored when UI isn't mounted
      }
    },
    [inputSetterRef],
  );

  const truncateFromLastMessage = useCallback(
    (role: UIMessage["role"]): Array<UIMessage> => {
      const messages = [...(syncStateRef.current.messages || [])];

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
    [smartSetState, syncStateRef],
  );

  type ModelResult = {
    response: { messages: Array<ModelMessage> };
    finishReason?: string;
  };

  const handleModelResult = useCallback(
    async (result: ModelResult, opts?: { abortSignal?: AbortSignal }) => {
      const messages = result?.response?.messages ?? [];
      addMessage(messages as unknown as Array<UIMessage>);
      const toolResponses = (await handleToolCall(
        messages,
        opts,
      )) as Array<ModelMessage>;
      addMessage(toolResponses as unknown as Array<UIMessage>);
      return toolResponses as unknown as Array<UIMessage>;
    },
    [addMessage, handleToolCall],
  );

  const stateGetters = useMemo(
    () => ({
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
      get taskList() {
        return syncStateRef.current.taskList || [];
      },
      get transcript() {
        const all = syncStateRef.current.messages || [];
        const topLevel = all.filter((m) => {
          const meta = (m as UIMessage).metadata as
            | { agentId?: string }
            | undefined;
          return m.role !== "ui" && !meta?.agentId;
        });
        return filterTranscript(topLevel as Array<UIMessage>);
      },
      get statusLine() {
        return syncStateRef.current.statusLine;
      },
      get slots() {
        return syncStateRef.current.slots;
      },
      get approvalPolicy() {
        return syncStateRef.current.approvalPolicy;
      },
    }),
    [syncStateRef],
  );

  // Agent API
  const agentsRef = useRef<Map<string, string>>(new Map());

  const makeAgentHandle = useCallback(
    (id: string, name: string) => {
      const tagUiMessage = (m: UIMessage): UIMessage => ({
        ...m,
        metadata: { ...(m.metadata || {}), agentId: id },
      });

      const sayForAgent = (text: string, metadata?: MessageMetadata) => {
        const message = tagUiMessage({ role: "ui", content: text, metadata });
        void smartSetState((prev) => ({
          ...prev,
          messages: [...prev.messages, message],
        }));
      };

      const addMessageForAgent = (message: UIMessage | Array<UIMessage>) => {
        const list = Array.isArray(message) ? message : [message];
        const tagged = list.map(tagUiMessage);
        void smartSetState((prev) => ({
          ...prev,
          messages: [...prev.messages, ...tagged],
        }));
      };

      const transcriptForAgent = (): Array<ModelMessage> => {
        const all = syncStateRef.current.messages || [];
        const mine = all.filter((m) => {
          const meta = (m as UIMessage).metadata as
            | { agentId?: string }
            | undefined;
          return m.role !== "ui" && meta?.agentId === id;
        });
        return filterTranscript(mine as Array<UIMessage>);
      };

      const handleModelResultsForAgent = async (
        result: ModelResult,
        opts?: { abortSignal?: AbortSignal },
      ): Promise<Array<UIMessage>> => {
        const messages = result?.response?.messages ?? [];
        addMessageForAgent(messages as unknown as Array<UIMessage>);
        const toolResponses = (await handleToolCall(messages, {
          ...(opts || {}),
        })) as Array<ModelMessage>;
        addMessageForAgent(toolResponses as unknown as Array<UIMessage>);
        return (toolResponses as unknown as Array<UIMessage>) || [];
      };

      const setName = (newName: string) => {
        agentsRef.current.set(id, newName);
        void smartSetState((prev) => ({
          ...prev,
          agentNames: { ...(prev.agentNames || {}), [id]: newName },
        }));
      };

      return {
        id,
        name,
        say: sayForAgent,
        addMessage: addMessageForAgent,
        transcript: transcriptForAgent,
        handleModelResults: handleModelResultsForAgent,
        setName,
      } as const;
    },
    [handleToolCall, smartSetState, syncStateRef],
  );

  const createAgent = useCallback(
    (name: string) => {
      const id = crypto.randomUUID();
      agentsRef.current.set(id, name);
      void smartSetState((prev) => ({
        ...prev,
        agentNames: { ...(prev.agentNames || {}), [id]: name },
      }));
      return makeAgentHandle(id, name);
    },
    [agentsRef, makeAgentHandle, smartSetState],
  );

  const getAgent = useCallback(
    (id: string) => {
      const name = agentsRef.current.get(id);
      if (!name) {
        return undefined;
      }
      return makeAgentHandle(id, name);
    },
    [agentsRef, makeAgentHandle],
  );

  const actions = useMemo(
    () => ({
      say,
      addMessage,
      setLoading,
      setInputDisabled,
      setStatusLine,
      setSlot,
      clearSlot,
      clearAllSlots,
      addToQueue,
      removeFromQueue,
      clearQueue,
      addTask,
      toggleTask,
      clearTaskList,
      setApprovalPolicy: setApprovalPolicyAction,
      setInputValue,
      truncateFromLastMessage,
      handleModelResult,
      createAgent,
      getAgent,
    }),
    [
      say,
      addMessage,
      setLoading,
      setInputDisabled,
      setStatusLine,
      setSlot,
      clearSlot,
      clearAllSlots,
      addToQueue,
      removeFromQueue,
      clearQueue,
      addTask,
      toggleTask,
      clearTaskList,
      setApprovalPolicyAction,
      setInputValue,
      truncateFromLastMessage,
      handleModelResult,
      createAgent,
      getAgent,
    ],
  );

  return {
    actions,
    stateGetters,
  } as const;
}
