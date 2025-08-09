import type { ApplyPatchCommand, ApprovalPolicy } from "../approvals.js";
import type { LibraryConfig } from "../lib.js";
import type { CommandConfirmation } from "../utils/agent/review.js";
import type { ExecInput } from "../utils/agent/sandbox/interface.js";
import type { ModelMessage, ToolCallPart } from "ai";

import { handleExecCommand } from "../utils/agent/handle-exec-command.js";
import { isNativeTool } from "../utils/ai.js";
import { log } from "../utils/logger/log.js";

/**
 * Execute a tool call and return the response
 * @param toolCall The tool call to execute
 * @param config The UI configuration
 * @param approvalPolicy The approval policy
 * @param additionalWritableRoots Additional writable roots
 * @param getCommandConfirmation Function to get command confirmation
 * @param signal Optional abort signal
 * @returns An array of ModelMessage responses from the tool
 */
export async function execToolCall(
  toolCall: ToolCallPart,
  config: LibraryConfig,
  approvalPolicy: ApprovalPolicy,
  additionalWritableRoots: ReadonlyArray<string>,
  getCommandConfirmation: (
    command: Array<string>,
    applyPatch: ApplyPatchCommand | undefined,
  ) => Promise<CommandConfirmation>,
  signal?: AbortSignal,
): Promise<Array<ModelMessage>> {
  // If the processing has been aborted, don't execute the tool
  if (signal?.aborted || toolCall == null) {
    return [];
  }

  const name: string | undefined = toolCall.toolName;
  const args = toolCall.input;
  const callId: string = toolCall.toolCallId;

  log(
    `execToolCall(): name=${
      name ?? "undefined"
    } callId=${callId} args=${JSON.stringify(args)}`,
  );

  if (args == null) {
    const result = `invalid arguments: ${JSON.stringify(args)}`;

    return [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: callId,
            output: {
              value: result,
              type: "json",
            },
            toolName: name,
          },
        ],
      },
    ];
  }

  let result = "no function found";
  const additionalItems: Array<ModelMessage> = [];

  if (isNativeTool(name)) {
    const {
      outputText,
      metadata,
      additionalItems: additionalItemsFromExec,
    } = await handleExecCommand(
      args as ExecInput,
      config,
      approvalPolicy,
      additionalWritableRoots,
      getCommandConfirmation,
      signal,
    );

    result = JSON.stringify({ output: outputText, metadata });

    if (additionalItemsFromExec) {
      additionalItems.push(...additionalItemsFromExec);
    }
  }

  return [
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: callId,
          output: {
            value: result,
            type: "json",
          },
          toolName: name,
        },
      ],
    },
    ...additionalItems,
  ];
}
