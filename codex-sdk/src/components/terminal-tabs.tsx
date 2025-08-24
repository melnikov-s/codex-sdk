import { Box, Text } from "ink";
import React from "react";

type TabItem = {
  id: string;
  title: string;
  isActive: boolean;
};

type Props = {
  tabs: Array<TabItem>;
  onTabClick: (id: string) => void;
};

export function TerminalTabs({
  tabs,
  onTabClick: _onTabClick,
}: Props): React.ReactElement {
  return (
    <Box marginTop={1} paddingY={0}>
      <Box flexDirection="row" gap={1}>
        {tabs.map((tab, index) => (
          <Box key={tab.id} flexDirection="row">
            <Text
              color={tab.isActive ? "blueBright" : "gray"}
              backgroundColor={tab.isActive ? "blue" : undefined}
              bold={tab.isActive}
            >
              {tab.title}
            </Text>
            {index < tabs.length - 1 && <Text color="gray"> │ </Text>}
          </Box>
        ))}
      </Box>
      <Text color="gray" dimColor>
        Press Ctrl+[ / Ctrl+] to switch tabs
      </Text>
    </Box>
  );
}
