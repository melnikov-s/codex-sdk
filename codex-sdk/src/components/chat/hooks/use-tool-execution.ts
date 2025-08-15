import type { ApprovalPolicy, ApplyPatchCommand } from "../../../approvals.js";
import type { LibraryConfig } from "../../../lib.js";
import type { CommandConfirmation } from "../../../utils/agent/review.js";
import type { ModelMessage } from "ai";
import type { MutableRefObject } from "react";

import { execToolCall } from "../../../tools/runtime.js";
import { getToolCall, isNativeTool } from "../../../utils/ai.js";
import { useCallback } from "react";

type SelectApi = {
  openSelection: (
    items: Array<{ label: string; value: string }>,
    options?: { label?: string; timeout?: number; defaultValue?: string },
  ) => Promise<string>;
  setOverlayMode: (mode: "selection" | "none") => void;
};

export function useToolExecution(params: {
  approvalPolicy: ApprovalPolicy;
  additionalWritableRoots: ReadonlyArray<string>;
  uiConfig: LibraryConfig;
  getCommandConfirmation: (
    command: ReadonlyArray<string>,
    applyPatch: ApplyPatchCommand | undefined,
  ) => Promise<CommandConfirmation>;
  syncApprovalPolicyRef: MutableRefObject<ApprovalPolicy | undefined>;
  selectionApi: SelectApi;
}) {
  const {
    approvalPolicy,
    additionalWritableRoots,
    uiConfig,
    getCommandConfirmation,
    syncApprovalPolicyRef,
    selectionApi,
  } = params;

  const execute = useCallback(
    async (
      messageOrMessages: ModelMessage | Array<ModelMessage>,
      { abortSignal }: { abortSignal?: AbortSignal } = {},
    ) => {
      const messages = Array.isArray(messageOrMessages)
        ? messageOrMessages
        : [messageOrMessages];

      const toolResponses: Array<ModelMessage> = [];

      for (const message of messages) {
        const toolCall = getToolCall(message);
        if (!toolCall || !isNativeTool(toolCall.toolName)) {continue;}

        if (toolCall.toolName === "user_select") {
          const { message: promptMessage, options, defaultValue } = toolCall.input as {
            message: string;
            options: Array<string>;
            defaultValue: string;
          };

          const transformed = (options || []).map((o) => ({ label: o, value: o }));
          const CUSTOM_INPUT_VALUE = "__CUSTOM_INPUT__";
          const enhanced = [
            ...transformed,
            { label: "None of the above (enter custom option)", value: CUSTOM_INPUT_VALUE },
          ];
          const validDefault = transformed.find((o) => o.value === defaultValue)?.value ?? (transformed[0]?.value ?? "yes");

          const userResponse = await selectionApi.openSelection(enhanced, {
            label: promptMessage,
            timeout: 45,
            defaultValue: validDefault,
          });

          toolResponses.push({
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: toolCall.toolCallId,
                output: { value: userResponse, type: "text" },
                toolName: toolCall.toolName,
              },
            ],
          } satisfies ModelMessage);
          continue;
        }

        const currentPolicy = syncApprovalPolicyRef.current || approvalPolicy;
        const results = await execToolCall(
          toolCall,
          uiConfig,
          currentPolicy,
          additionalWritableRoots,
          getCommandConfirmation,
          abortSignal,
        );
        if (results[0]) {toolResponses.push(results[0]);}
      }

      if (Array.isArray(messageOrMessages)) {return toolResponses;}
      return toolResponses[0] || null;
    },
    [approvalPolicy, additionalWritableRoots, uiConfig, getCommandConfirmation, selectionApi, syncApprovalPolicyRef],
  );

  return execute;
}


