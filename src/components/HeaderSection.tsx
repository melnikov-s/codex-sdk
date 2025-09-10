import type { ApprovalPolicy } from "../approvals.js";
import type { HeaderConfig } from "../utils/workflow-config.js";

import AppHeader from "./chat/app-header.js";
import WorkflowHeader from "./chat/workflow-header.js";
import { Box, Text } from "ink";
import React from "react";

export interface HeaderSectionProps {
  title?: React.ReactNode;
  terminalRows: number;
  version: string;
  PWD: string;
  approvalPolicy: ApprovalPolicy;
  colorsByPolicy: Record<ApprovalPolicy, "green" | undefined>;
  headers: Array<HeaderConfig>;
  workflowHeader: string;
}

export function HeaderSection({
  title,
  terminalRows,
  version,
  PWD,
  approvalPolicy,
  colorsByPolicy,
  headers,
  workflowHeader,
}: HeaderSectionProps): JSX.Element {
  return (
    <Box paddingX={2} flexDirection="column">
      {title && <Text>{title}</Text>}
      <AppHeader
        terminalRows={terminalRows}
        version={version}
        PWD={PWD}
        approvalPolicy={approvalPolicy}
        colorsByPolicy={colorsByPolicy}
        headers={headers}
      />
      <WorkflowHeader workflowHeader={workflowHeader} />
    </Box>
  );
}
