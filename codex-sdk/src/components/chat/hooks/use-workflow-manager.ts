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
} from "../../../workflow";

import { useToolExecution } from "./use-tool-execution.js";
import { useWorkflowActions } from "./use-workflow-actions.js";
import { useCommandConfirmation } from "../../../hooks/use-command-confirmation.js";
import { useSmartState } from "../../../hooks/use-smart-state.js";
import { defaultWorkflow } from "../../../workflow/default-agent.js";
import { createShellTool, createApplyPatchTool, createUserSelectTool } from "../tools/definitions.js";
import { useEffect, useRef, useState } from "react";


export function useWorkflowManager(params: {
  initialApprovalPolicy: ApprovalPolicy;
  additionalWritableRoots: ReadonlyArray<string>;
  uiConfig: LibraryConfig;
  workflowFactory?: WorkflowFactory;
  selectionApi: {
    openSelection: (
      items: Array<{ label: string; value: string }>,
      options?: { label?: string; timeout?: number; defaultValue?: string },
    ) => Promise<string>;
    setOverlayMode: (mode: "selection" | "none") => void;
  };
  promptApi: {
    openPrompt: (
      message: string,
      options?: PromptOptions | PromptOptionsWithTimeout,
    ) => Promise<string>;
    openConfirmation: (
      message: string,
      options?: ConfirmOptions | ConfirmOptionsWithTimeout,
    ) => Promise<boolean>;
  };
}) {
  const { initialApprovalPolicy, additionalWritableRoots, uiConfig, workflowFactory, selectionApi, promptApi } = params;

  const { state, setState: smartSetState, syncRef } = useSmartState<WorkflowState>({
    loading: false,
    messages: [],
    inputDisabled: false,
    queue: [],
    taskList: [],
    statusLine: undefined,
    slots: undefined,
    approvalPolicy: initialApprovalPolicy,
  });

  const [approvalPolicy, setApprovalPolicy] = useState<ApprovalPolicy>(initialApprovalPolicy);

  const { getCommandConfirmation, confirmationPrompt, explanation, submitConfirmation } =
    useCommandConfirmation();

  const syncApprovalPolicyRef = useRef<ApprovalPolicy | undefined>(initialApprovalPolicy);
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
  });

  const { actions, stateGetters } = useWorkflowActions({
    smartSetState,
    syncStateRef: syncRef,
    setApprovalPolicy,
    handleToolCall,
  });

  const workflowRef = useRef<Workflow | null>(null);
  const [displayConfig, setDisplayConfig] = useState<Workflow["displayConfig"] | undefined>(undefined);

  useEffect(() => {
    // If waiting on a pending confirmation, don't rebuild the workflow
    if (confirmationPrompt != null) {
      return;
    }

    workflowRef.current?.terminate?.();

    const workflowHooks: WorkflowHooks = {
      setState: smartSetState,
      state: stateGetersProxy(stateGetters),
      actions,
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
          options?: SelectOptions | SelectOptionsWithTimeout,
        ) => selectionApi.openSelection(items as Array<{ label: string; value: string }>, options as { label?: string; timeout?: number; defaultValue?: string } | undefined),
        confirm: (
          message: string,
          options?: ConfirmOptions | ConfirmOptionsWithTimeout,
        ) => promptApi.openConfirmation(message, options),
        input: (
          message: string,
          options?: PromptOptions | PromptOptionsWithTimeout,
        ) => promptApi.openPrompt(message, options),
      },
      approval: {
        getPolicy: () => syncRef.current.approvalPolicy || initialApprovalPolicy,
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
          const currentPolicy = syncRef.current.approvalPolicy || initialApprovalPolicy;
          return canAutoApprove(command, workdir, currentPolicy, writableRoots || additionalWritableRoots);
        },
      },
    } as WorkflowHooks;

    const factory = workflowFactory || defaultWorkflow;
    workflowRef.current = factory(workflowHooks);
    setDisplayConfig(workflowRef.current?.displayConfig);
    workflowRef.current?.initialize?.();

    return () => {
      workflowRef.current?.terminate?.();
      workflowRef.current = null;
    };
  }, [confirmationPrompt, smartSetState, stateGetters, actions, handleToolCall, selectionApi, promptApi, initialApprovalPolicy, additionalWritableRoots, workflowFactory, syncRef]);

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
  } as const;
}

type StateGetters = Pick<WorkflowHooks["state"],
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


