import type { ApprovalPolicy } from "../approvals.js";
import type { HeaderConfig } from "../lib.js";
import type { ColorName } from "chalk";

import AppHeader from "./chat/app-header";
import { TerminalChatSelect } from "./chat/terminal-chat-select";
import { Box, Text } from "ink";
import React from "react";

type Props = {
  title?: React.ReactNode;
  promptText: string;
  terminalRows: number;
  version: string;
  PWD: string;
  approvalPolicy: ApprovalPolicy;
  colorsByPolicy: Record<ApprovalPolicy, ColorName | undefined>;
  headers?: Array<HeaderConfig>;
  items: Array<{ label: string; value: string }>;
  onSelect: (value: string) => void;
  onCancel: () => void;
  isActive?: boolean;
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
}: Props): JSX.Element {
  return (
    <Box flexDirection="column" alignItems="flex-start">
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
      </Box>
      <Box paddingX={2}>
        <Text>{promptText}</Text>
        <Text> </Text>
        <TerminalChatSelect
          items={items}
          onSelect={onSelect}
          onCancel={onCancel}
          isActive={isActive}
        />
      </Box>
    </Box>
  );
}
