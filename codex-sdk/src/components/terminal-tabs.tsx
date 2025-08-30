import type { DisplayConfig } from "../workflow/index.js";

import { componentStyles, spacing } from "../utils/design-system.js";
import { Box, Text } from "ink";
import React from "react";

type TabItem = {
  id: string;
  title: string;
  isActive: boolean;
  isLoading?: boolean;
};

type Props = {
  tabs: Array<TabItem>;
  onTabClick: (id: string) => void;
  displayConfig?: DisplayConfig;
  workflowStatus?: string;
  isMultiWorkflowMode?: boolean;
};

export function TerminalTabs({
  tabs,
  onTabClick: _onTabClick,
  displayConfig,
  workflowStatus,
  isMultiWorkflowMode = false,
}: Props): React.ReactElement {
  const tabConfig = displayConfig?.tabs;

  const headerText =
    tabConfig?.header == null ? null : tabConfig?.header || "Active Workflows";

  const containerProps = {
    flexDirection: "column" as const,
    marginBottom: spacing.sm,
    ...tabConfig?.containerProps,
  };

  const headerStyle = {
    ...componentStyles.tabs.header,
    ...tabConfig?.headerStyle,
  };

  const activeTabStyle = {
    ...componentStyles.tabs.active,
    ...tabConfig?.activeTab,
  };

  const inactiveTabStyle = {
    ...componentStyles.tabs.inactive,
    ...tabConfig?.inactiveTab,
  };

  const instructionStyle = {
    ...componentStyles.tabs.instruction,
    ...tabConfig?.instructionStyle,
  };

  return (
    <Box {...containerProps}>
      {headerText && tabs.length > 1 && (
        <Box marginBottom={headerStyle.marginBottom}>
          <Text color={headerStyle.color} bold={headerStyle.bold}>
            {headerText}
          </Text>
        </Box>
      )}

      {tabs.length > 1 && (
        <Box flexDirection="row">
          {tabs.map((tab) => (
            <Box key={tab.id} marginRight={1}>
              {tab.isActive ? (
                <Box flexDirection="column">
                  <Text {...activeTabStyle}>{` ${tab.title} `}</Text>
                  <Text color={activeTabStyle.backgroundColor || "cyan"}>
                    {"▔".repeat(tab.title.length + 2)}
                  </Text>
                </Box>
              ) : (
                <Text
                  {...inactiveTabStyle}
                  color={tab.isLoading ? "gray" : "cyan"}
                >
                  {` ${tab.title} `}
                </Text>
              )}
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={instructionStyle.marginTop}>
        {isMultiWorkflowMode && (
          <Text
            color={instructionStyle.color}
            dimColor={instructionStyle.dimColor}
          >
            {workflowStatus && `${workflowStatus} — `}
            Ctrl+K: app commands
            {tabs.length > 1 && " — Press Ctrl+O / Ctrl+P to switch tabs"}
          </Text>
        )}
      </Box>
    </Box>
  );
}
