import type { HotkeyAction } from "../hooks/use-global-hotkeys.js";

import { Box, Text } from "ink";
import React from "react";

interface ControlsDisplayProps {
  hotkeys: Array<HotkeyAction>;
  title?: string;
  compact?: boolean;
}

export function ControlsDisplay({
  hotkeys,
  title = "Controls",
  compact = false,
}: ControlsDisplayProps): JSX.Element {
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

  if (compact) {
    return (
      <Box flexDirection="row" gap={2}>
        {hotkeys.map((hotkey, index) => (
          <Text key={index} dimColor>
            <Text bold>{formatKeyCombo(hotkey)}</Text>
            {hotkey.description && ` ${hotkey.description}`}
          </Text>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold dimColor>
        {title}
      </Text>
      <Box flexDirection="column" paddingLeft={2}>
        {hotkeys.map((hotkey, index) => (
          <Box
            key={index}
            flexDirection="row"
            justifyContent="space-between"
            minWidth={40}
          >
            <Text dimColor bold>
              {formatKeyCombo(hotkey)}
            </Text>
            {hotkey.description && <Text dimColor>– {hotkey.description}</Text>}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
