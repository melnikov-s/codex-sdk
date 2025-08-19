import type { TerminalHeaderProps } from "./terminal-header.js";
import type { UIMessage } from "../../utils/ai.js";
import type { DisplayConfig, WorkflowState } from "../../workflow";

import TerminalMessageHistory from "./terminal-message-history.js";
import { Box } from "ink";
import React from "react";

type HeaderProps = TerminalHeaderProps;

type Props = {
  show: boolean;
  batch: Array<{ item: UIMessage }>;
  groupCounts: Record<string, number>;
  items: Array<UIMessage>;
  userMsgCount: number;
  confirmationPrompt?: React.ReactNode | null;
  loading: boolean;
  fullStdout: boolean;
  displayConfig?: DisplayConfig;
  workflowState: WorkflowState;
  headerProps: HeaderProps;
};

export default function WorkflowPane(props: Props): React.ReactElement | null {
  if (!props.show) {
    return null;
  }
  return (
    <Box flexDirection="column">
      <TerminalMessageHistory
        batch={props.batch}
        groupCounts={props.groupCounts}
        items={props.items}
        userMsgCount={props.userMsgCount}
        confirmationPrompt={props.confirmationPrompt}
        loading={props.loading}
        fullStdout={props.fullStdout}
        displayConfig={props.displayConfig}
        slots={props.workflowState.slots}
        headerProps={props.headerProps}
      />
    </Box>
  );
}


