import type { Workflow } from "../workflow";

import { componentStyles, spacing } from "../utils/design-system.js";
import {
  getAllAvailableCommands,
  type SlashCommand,
} from "../utils/slash-commands.js";
import { Box, Text, useInput } from "ink";
import React from "react";

/**
 * An overlay that lists the available slash‑commands and their description.
 * The overlay is purely informational and can be dismissed with the Escape
 * key. Keeping the implementation extremely small avoids adding any new
 * dependencies or complex state handling.
 */
export default function HelpOverlay({
  onExit,
  workflow,
}: {
  onExit: () => void;
  workflow?: Workflow | null;
}): JSX.Element {
  useInput((input, key) => {
    if (key.escape || input === "q") {
      onExit();
    }
  });

  const workflowCommands = getAllAvailableCommands(workflow?.commands || {});

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      width={80}
      alignSelf="flex-start"
    >
      <Box paddingX={spacing.sm}>
        <Text {...componentStyles.header.primary}>Available commands</Text>
      </Box>

      <Box flexDirection="column" paddingX={spacing.sm} paddingTop={spacing.sm}>
        <Text {...componentStyles.help.section}>Workflow commands</Text>
        {workflowCommands.map((cmd: SlashCommand) => (
          <Text key={cmd.command} {...componentStyles.help.description}>
            <Text {...componentStyles.help.command}>{cmd.command}</Text> –{" "}
            {cmd.description}
          </Text>
        ))}

        <Box marginTop={spacing.sm}>
          <Text {...componentStyles.help.section}>Keyboard shortcuts</Text>
        </Box>
        <Text {...componentStyles.help.description}>
          <Text {...componentStyles.help.shortcut}>Enter</Text> – send message
        </Text>
        <Text {...componentStyles.help.description}>
          <Text {...componentStyles.help.shortcut}>Ctrl+J</Text> – insert
          newline
        </Text>
        <Text {...componentStyles.help.description}>
          <Text {...componentStyles.help.shortcut}>Ctrl+O</Text> – previous
          workflow
        </Text>
        <Text {...componentStyles.help.description}>
          <Text {...componentStyles.help.shortcut}>Ctrl+P</Text> – next workflow
        </Text>
        <Text {...componentStyles.help.description}>
          <Text {...componentStyles.help.shortcut}>Ctrl+K</Text> – app commands
          (switch/create/close workflows)
        </Text>
        <Text {...componentStyles.help.description}>
          <Text {...componentStyles.help.shortcut}>Up/Down</Text> – scroll
          prompt history
        </Text>
        <Text {...componentStyles.help.description}>
          <Text {...componentStyles.help.shortcut}>
            Esc<Text dimColor>(✕2)</Text>
          </Text>{" "}
          – interrupt current action
        </Text>
        <Text {...componentStyles.help.description}>
          <Text {...componentStyles.help.shortcut}>Ctrl+C</Text> – quit{" "}
          {workflow?.title ?? "Codex SDK"}
        </Text>
      </Box>

      <Box paddingX={spacing.sm}>
        <Text {...componentStyles.tabs.instruction}>esc or q to close</Text>
      </Box>
    </Box>
  );
}
