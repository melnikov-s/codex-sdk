import type { Workflow } from "../workflow";

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

  // Note: Don't memoize this since disabled functions need to be evaluated with current state
  const allCommands = getAllAvailableCommands(workflow?.commands || {});
  const uiCommands = allCommands.filter((cmd) => cmd.source === "ui");
  const workflowCommands = allCommands.filter(
    (cmd) => cmd.source === "workflow",
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      width={80}
    >
      <Box paddingX={1}>
        <Text bold>Available commands</Text>
      </Box>

      <Box flexDirection="column" paddingX={1} paddingTop={1}>
        <Text bold dimColor>
          System commands
        </Text>
        {uiCommands.map((cmd: SlashCommand) => (
          <Text key={cmd.command}>
            <Text color="cyan">{cmd.command}</Text> – {cmd.description}
          </Text>
        ))}

        {workflowCommands.length > 0 && (
          <>
            <Box marginTop={1}>
              <Text bold dimColor>
                Workflow commands
              </Text>
            </Box>
            {workflowCommands.map((cmd: SlashCommand) => (
              <Text key={cmd.command}>
                <Text color="magenta">{cmd.command}</Text> – {cmd.description}
              </Text>
            ))}
          </>
        )}

        <Box marginTop={1}>
          <Text bold dimColor>
            Keyboard shortcuts
          </Text>
        </Box>
        <Text>
          <Text color="yellow">Enter</Text> – send message
        </Text>
        <Text>
          <Text color="yellow">Ctrl+J</Text> – insert newline
        </Text>
        {/* Re-enable once we re-enable new input */}
        {/*
        <Text>
          <Text color="yellow">Ctrl+X</Text>/<Text color="yellow">Ctrl+E</Text>
          &nbsp;– open external editor ($EDITOR)
        </Text>
        */}
        <Text>
          <Text color="yellow">Up/Down</Text> – scroll prompt history
        </Text>
        <Text>
          <Text color="yellow">
            Esc<Text dimColor>(✕2)</Text>
          </Text>{" "}
          – interrupt current action
        </Text>
        <Text>
          <Text color="yellow">Ctrl+C</Text> – quit{" "}
          {workflow?.title ?? "Codex SDK"}
        </Text>
      </Box>

      <Box paddingX={1}>
        <Text dimColor>esc or q to close</Text>
      </Box>
    </Box>
  );
}
