import type { HotkeyAction } from "../hooks/use-global-hotkeys.js";
import type { DisplayConfig } from "../workflow/index.js";

import { componentStyles, spacing } from "../utils/design-system.js";
import { Box, Text } from "ink";
import React from "react";

function renderControls(
  hotkeys: Array<HotkeyAction>,
  tabCount: number,
): string {
  // Filter out tab navigation shortcuts (Ctrl+Tab, Ctrl+Shift+Tab)
  const filteredHotkeys = hotkeys.filter(
    (hotkey) => !(hotkey.key === "tab" && hotkey.ctrl),
  );

  // Filter out previous/next workflow controls if we have less than 2 tabs
  const relevantHotkeys =
    tabCount > 1
      ? filteredHotkeys
      : filteredHotkeys.filter(
          (hotkey) =>
            hotkey.description !== "Previous workflow" &&
            hotkey.description !== "Next workflow" &&
            hotkey.description !== "Next non-loading workflow",
        );

  // Format hotkey combinations
  const formatKeyCombo = (hotkey: HotkeyAction): string => {
    const parts: Array<string> = [];
    if (hotkey.ctrl) {
      parts.push("Ctrl");
    }
    if (hotkey.meta) {
      parts.push("Cmd");
    }
    if (hotkey.shift) {
      parts.push("Shift");
    }
    parts.push(hotkey.key.toUpperCase());
    return parts.join("+");
  };

  // Convert to display format
  const controlStrings = relevantHotkeys.map((hotkey) => {
    const keyCombo = formatKeyCombo(hotkey);
    const description = hotkey.description?.toLowerCase() || "";
    return `${keyCombo}: ${description}`;
  });

  return controlStrings.join(" — ");
}

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
  availableHotkeys?: Array<HotkeyAction>;
};

export function TerminalTabs({
  tabs,
  onTabClick: _onTabClick,
  displayConfig,
  workflowStatus,
  availableHotkeys = [],
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
        {tabs.length > 1 && (
          <Text
            color={instructionStyle.color}
            dimColor={instructionStyle.dimColor}
          >
            {workflowStatus && `${workflowStatus} — `}
            {renderControls(availableHotkeys, tabs.length)}
          </Text>
        )}
      </Box>
    </Box>
  );
}
