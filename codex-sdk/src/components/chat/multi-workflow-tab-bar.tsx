import type { WorkflowInfo } from "../../workflow/index.js";

import { Box, Text } from "ink";
import React from "react";

export interface InteractiveWorkflowTabBarProps {
  workflows: Array<WorkflowInfo>;
  activeId: string;
  onSwitchWorkflow: (id: string) => void;
  mouseEnabled?: boolean;
}

const InteractiveWorkflowTabBar: React.FC<InteractiveWorkflowTabBarProps> = ({
  workflows,
  activeId,
  onSwitchWorkflow: _onSwitchWorkflow,
  mouseEnabled: _mouseEnabled = false,
}) => {
  if (workflows.length <= 1) {
    return null; // Don't show tabs for single workflow
  }

  // Get status indicator for workflow
  const getStatusIndicator = (workflow: WorkflowInfo): string => {
    if (workflow.isActive) {
      return "▶";
    }
    if (workflow.status === "loading") {
      return "⏳";
    }
    if (workflow.status === "error") {
      return "❌";
    }
    if (workflow.attention.requiresInput) {
      return "⚠️";
    }
    if (workflow.attention.hasNotification) {
      return "🔔";
    }
    return "●";
  };

  // Truncate title to fit in tab
  const truncateTitle = (title: string, maxLength: number = 12): string => {
    if (title.length <= maxLength) {
      return title;
    }
    return title.substring(0, maxLength - 1) + "…";
  };

  // Show up to 7 tabs, then indicate overflow
  const visibleWorkflows = workflows.slice(0, 7);
  const hasOverflow = workflows.length > 7;

  return (
    <Box flexDirection="row" gap={1} paddingX={1} paddingY={0}>
      <Text dimColor>Workflows:</Text>
      {visibleWorkflows.map((workflow, index) => {
        const isActive = workflow.id === activeId;
        const indicator = getStatusIndicator(workflow);
        const title = truncateTitle(workflow.title);

        return (
          <Box key={workflow.id} marginRight={1}>
            <Text
              color={isActive ? "blueBright" : "gray"}
              backgroundColor={isActive ? "blue" : undefined}
              bold={isActive}
            >
              {" "}
              {indicator} {index + 1}:{title}{" "}
            </Text>
          </Box>
        );
      })}

      {hasOverflow && <Text dimColor>+{workflows.length - 7} more...</Text>}

      <Box marginLeft={2}>
        <Text dimColor>Ctrl+1-9: Switch • Ctrl+Tab: Next • Ctrl+`: Picker</Text>
      </Box>
    </Box>
  );
};

export default InteractiveWorkflowTabBar;
