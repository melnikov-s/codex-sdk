import type { ApprovalPolicy } from "../approvals.js";
import type { HotkeyAction } from "../hooks/use-global-hotkeys.js";
import type { HeaderConfig } from "../lib.js";
import type { ColorName } from "chalk";

import AppHeader from "./chat/app-header";
import { TerminalChatSelect } from "./chat/terminal-chat-select";
import { componentStyles } from "../utils/design-system.js";
import { Box, Text } from "ink";
import React from "react";

function renderSubtleControls(hotkeys: Array<HotkeyAction>): string {
  // Filter out tab navigation shortcuts (Ctrl+Tab, Ctrl+Shift+Tab)
  const filteredHotkeys = hotkeys.filter(
    (hotkey) => !(hotkey.key === "tab" && hotkey.ctrl),
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
  const controlStrings = filteredHotkeys.map((hotkey) => {
    const keyCombo = formatKeyCombo(hotkey);
    const description = hotkey.description?.toLowerCase() || "";
    return `${keyCombo}: ${description}`;
  });

  return controlStrings.join(" — ");
}

type Props = {
  title?: React.ReactNode;
  promptText: string;
  terminalRows: number;
  version: string;
  PWD: string;
  approvalPolicy: ApprovalPolicy;
  colorsByPolicy: Record<ApprovalPolicy, ColorName | undefined>;
  headers?: Array<HeaderConfig>;
  items: Array<{ label: string; value: string; isLoading?: boolean }>;
  onSelect: (value: string) => void;
  onCancel: () => void;
  isActive?: boolean;
  availableHotkeys?: Array<HotkeyAction>;
  showControls?: boolean;
};

export function WorkflowOverlay({
  title,
  promptText,
  terminalRows,
  version,
  PWD,
  approvalPolicy,
  colorsByPolicy,
  headers,
  items,
  onSelect,
  onCancel,
  isActive = true,
  availableHotkeys = [],
  showControls = true,
}: Props): JSX.Element {
  return (
    <Box flexDirection="column" alignItems="flex-start" width="100%">
      <Box paddingX={2} flexDirection="column" marginBottom={1}>
        {title && <Text>{title}</Text>}
        <AppHeader
          terminalRows={terminalRows}
          version={version}
          PWD={PWD}
          approvalPolicy={approvalPolicy}
          colorsByPolicy={colorsByPolicy}
          headers={headers}
        />
      </Box>
      <Box paddingX={2} flexDirection="column" alignItems="flex-start">
        <Text>{promptText}</Text>
        <Box marginTop={1}>
          <TerminalChatSelect
            items={items}
            onSelect={onSelect}
            onCancel={onCancel}
            isActive={isActive}
          />
        </Box>
        {showControls && availableHotkeys.length > 0 && (
          <Box marginTop={1}>
            <Text {...componentStyles.tabs.instruction}>
              {renderSubtleControls(availableHotkeys)}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
