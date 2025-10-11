import type { ApprovalPolicy } from "../../../approvals.js";
import type { LibraryConfig } from "../../../lib.js";
import type {
  Workflow,
  WorkflowFactory,
  WorkflowHooks,
  WorkflowState,
  SelectItem,
  SelectOptions,
  SelectOptionsWithTimeout,
  ConfirmOptions,
  ConfirmOptionsWithTimeout,
  PromptOptions,
  PromptOptionsWithTimeout,
  WorkflowController,
} from "../../../workflow";
import type { ModelMessage } from "ai";

import { useToolExecution } from "./use-tool-execution.js";
import { useWorkflowActions } from "./use-workflow-actions.js";
import { useCommandConfirmation } from "../../../hooks/use-command-confirmation.js";
import { useSmartState } from "../../../hooks/use-smart-state.js";
import {
  createShellTool,
  createApplyPatchTool,
  createUserSelectTool,
} from "../tools/definitions.js";
import { useEffect, useRef, useState, useMemo } from "react";

export function useWorkflowManager(params: {
  initialApprovalPolicy: ApprovalPolicy;
  additionalWritableRoots: ReadonlyArray<string>;
  uiConfig: LibraryConfig;
  workflowFactory: WorkflowFactory;
  onController?: (controller: WorkflowController) => void;
  selectionApi: {
    openSelection: (
      items: Array<{ label: string; value: string; isLoading?: boolean }>,
      options: { label?: string; timeout?: number; defaultValue: string },
    ) => Promise<string>;
    setOverlayMode: (mode: "selection" | "none") => void;
  };
  promptApi: {
    openPrompt: (
      message: string,
      options: PromptOptions | PromptOptionsWithTimeout,
    ) => Promise<string>;
    openConfirmation: (
      message: string,
      options: ConfirmOptions | ConfirmOptionsWithTimeout,
    ) => Promise<boolean>;
  };
}) {
  const {
    initialApprovalPolicy,
    additionalWritableRoots,
    uiConfig,
    workflowFactory,
    selectionApi,
    promptApi,
    onController,
  } = params;

  const {
    state,
    setState: smartSetState,
    syncRef,
  } = useSmartState<WorkflowState>({
    loading: false,
    messages: [],
    inputDisabled: false,
    queue: [],
    taskList: [],
    statusLine: undefined,
    slots: undefined,
    agentNames: {},
    approvalPolicy: initialApprovalPolicy,
  });

  const [approvalPolicy, setApprovalPolicy] = useState<ApprovalPolicy>(
    initialApprovalPolicy,
  );

  const {
    getCommandConfirmation,
    confirmationPrompt,
    explanation,
    submitConfirmation,
  } = useCommandConfirmation();

  const syncApprovalPolicyRef = useRef<ApprovalPolicy | undefined>(
    initialApprovalPolicy,
  );
  useEffect(() => {
    syncApprovalPolicyRef.current = state.approvalPolicy;
  }, [state.approvalPolicy]);

  const handleToolCall = useToolExecution({
    approvalPolicy,
    additionalWritableRoots,
    uiConfig,
    getCommandConfirmation,
    syncApprovalPolicyRef,
    selectionApi,
    dispatchUserMessage: (message: ModelMessage) => {
      // Route user messages back into the workflow's normal message path
      const normalized: ModelMessage =
        typeof message === "string"
          ? { role: "user", content: message }
          : message;
      workflowRef.current?.message(normalized);
    },
  });

  const inputSetterRef = useRef<((value: string) => void) | undefined>(
    undefined,
  );

  const { actions, stateGetters } = useWorkflowActions({
    smartSetState,
    syncStateRef: syncRef,
    setApprovalPolicy,
    handleToolCall,
    inputSetterRef,
  });

  const workflowRef = useRef<Workflow | null>(null);
  const [displayConfigRaw, setDisplayConfig] = useState<
    Workflow["displayConfig"] | undefined
  >(undefined);

  const displayConfig = useMemo(() => {
    const resolver = (id: string) =>
      (syncRef.current.agentNames && syncRef.current.agentNames[id]) || id;
    return displayConfigRaw
      ? { ...displayConfigRaw, agentNameResolver: resolver }
      : { agentNameResolver: resolver };
  }, [displayConfigRaw, syncRef]);

  useEffect(() => {
    // Build the workflow once (and when the factory changes). Keep the instance
    // stable during transient UI state changes (e.g. confirmation overlays)
    // to avoid teardown flicker and lost state.

    const factory = workflowFactory;

    const workflowHooks: WorkflowHooks = {
      setState: smartSetState,
      state: stateGetersProxy(stateGetters),
      actions,
      control: {
        message: (input: string | ModelMessage) => {
          const normalized: ModelMessage =
            typeof input === "string"
              ? { role: "user", content: input }
              : input;
          workflowRef.current?.message(normalized);
        },
        stop: () => workflowRef.current?.stop?.(),
        terminate: () => workflowRef.current?.terminate?.(),
      },
      tools: {
        definitions: {
          shell: createShellTool(),
          apply_patch: createApplyPatchTool(),
          user_select: createUserSelectTool(),
        },
        execute: handleToolCall as WorkflowHooks["tools"]["execute"],
      },
      prompts: {
        select: (
          items: Array<SelectItem>,
          options: SelectOptions | SelectOptionsWithTimeout,
        ) =>
          selectionApi.openSelection(
            items as Array<{
              label: string;
              value: string;
              isLoading?: boolean;
            }>,
            options as {
              label?: string;
              timeout?: number;
              defaultValue: string;
            },
          ),
        confirm: (
          message: string,
          options: ConfirmOptions | ConfirmOptionsWithTimeout,
        ) => promptApi.openConfirmation(message, options),
        input: (
          message: string,
          options: PromptOptions | PromptOptionsWithTimeout,
        ) => promptApi.openPrompt(message, options),
      },
      approval: {
        getPolicy: () =>
          syncRef.current.approvalPolicy || initialApprovalPolicy,
        setPolicy: (policy: ApprovalPolicy) => {
          setApprovalPolicy(policy);
          void smartSetState({ approvalPolicy: policy });
        },
        canAutoApprove: async (
          command: ReadonlyArray<string>,
          workdir?: string,
          writableRoots?: ReadonlyArray<string>,
        ) => {
          const { canAutoApprove } = await import("../../../approvals.js");
          const currentPolicy =
            syncRef.current.approvalPolicy || initialApprovalPolicy;
          return canAutoApprove(
            command,
            workdir,
            currentPolicy,
            writableRoots || additionalWritableRoots,
            uiConfig.safeCommands || [],
          );
        },
      },
    } as WorkflowHooks;

    workflowRef.current = factory(workflowHooks);
    setDisplayConfig(workflowRef.current?.displayConfig);
    workflowRef.current?.initialize?.();

    // Surface controller if requested
    if (onController) {
      const controller: WorkflowController = {
        headless: false,
        message: (input: string | ModelMessage) => {
          const normalized: ModelMessage =
            typeof input === "string"
              ? { role: "user", content: input }
              : input;
          workflowRef.current?.message(normalized);
        },
        stop: () => workflowRef.current?.stop?.(),
        terminate: () => workflowRef.current?.terminate?.(),
        getState: () => syncRef.current,
        setState: smartSetState,
      };
      onController(controller);
    }

    return () => {
      workflowRef.current?.terminate?.();
      workflowRef.current = null;
    };
    // Only rebuild when the factory itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowFactory]);

  return {
    workflow: workflowRef.current,
    displayConfig,
    state,
    smartSetState,
    syncRef,
    actions,
    stateGetters,
    approvalPolicy,
    setApprovalPolicy,
    getCommandConfirmation,
    confirmationPrompt,
    explanation,
    submitConfirmation,
    inputSetterRef,
  } as const;
}

type StateGetters = Pick<
  WorkflowHooks["state"],
  | "loading"
  | "messages"
  | "inputDisabled"
  | "queue"
  | "taskList"
  | "transcript"
  | "statusLine"
  | "slots"
  | "approvalPolicy"
>;

function stateGetersProxy(getters: StateGetters): WorkflowHooks["state"] {
  return new Proxy(
    {},
    {
      get: (_target, prop: keyof StateGetters) => getters[prop],
    },
  ) as WorkflowHooks["state"];
}
