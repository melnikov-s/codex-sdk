import type { ReactNode } from "react";

import { componentStyles, spacing } from "../../utils/design-system.js";
import { Box, Text } from "ink";
import React from "react";

export interface WorkflowHeaderProps {
  workflowHeader?: ReactNode;
}

const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({ workflowHeader }) => {
  if (!workflowHeader) {
    return null;
  }

  return (
    <Box borderStyle="round" paddingX={spacing.sm} width={64}>
      <Text {...componentStyles.header.primary}>{workflowHeader}</Text>
    </Box>
  );
};

export default WorkflowHeader;
