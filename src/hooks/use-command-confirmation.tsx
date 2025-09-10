import type { ApplyPatchCommand } from "../approvals.js";
import type { CommandConfirmation } from "../utils/agent/review.js";

import { formatCommandForDisplay } from "../format-command.js";
import { useConfirmation } from "./use-confirmation.js";
import { TerminalChatToolCallCommand } from "../components/chat/terminal-chat-tool-call-command.js";
import { ReviewDecision } from "../utils/agent/review.js";
import React from "react";

export function useCommandConfirmation() {
  const {
    requestConfirmation,
    confirmationPrompt,
    explanation,
    submitConfirmation,
  } = useConfirmation();

  const getCommandConfirmation = React.useCallback(
    async (
      command: ReadonlyArray<string>,
      applyPatch: ApplyPatchCommand | undefined,
    ): Promise<CommandConfirmation> => {
      const commandForDisplay = formatCommandForDisplay([...command]);

      let { decision: review, customDenyMessage } = await requestConfirmation(
        <TerminalChatToolCallCommand commandForDisplay={commandForDisplay} />,
      );

      if (review === ReviewDecision.EXPLAIN) {
        const fallbackExplanation =
          "Command explanation is now handled by the consumer's workflow implementation.";

        const confirmResult = await requestConfirmation(
          <TerminalChatToolCallCommand
            commandForDisplay={commandForDisplay}
            explanation={fallbackExplanation}
          />,
        );

        review = confirmResult.decision;
        customDenyMessage = confirmResult.customDenyMessage;

        return {
          review,
          customDenyMessage,
          applyPatch,
          explanation: fallbackExplanation,
        };
      }

      return { review, customDenyMessage, applyPatch };
    },
    [requestConfirmation],
  );

  return {
    getCommandConfirmation,
    confirmationPrompt,
    explanation,
    submitConfirmation,
  } as const;
}
