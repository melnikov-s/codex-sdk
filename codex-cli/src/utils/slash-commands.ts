// Defines the available slash commands and their descriptions.
// Used for autocompletion in the chat input.
export interface SlashCommand {
  command: string;
  description: string;
  source?: "ui" | "workflow";
}

// Default commands handled by the UI layer
export const DEFAULT_UI_COMMANDS: Array<SlashCommand> = [
  {
    command: "/clearhistory",
    description: "Clear command history",
    source: "ui",
  },
  {
    command: "/history",
    description: "Open command history",
    source: "ui",
  },
  {
    command: "/help",
    description: "Show list of commands",
    source: "ui",
  },
  {
    command: "/approval",
    description: "Open approval mode selection panel",
    source: "ui",
  },
  {
    command: "/diff",
    description:
      "Show git diff of the working directory (or applied patches if not in git)",
    source: "ui",
  },
];

/**
 * Combine default UI commands with workflow-provided commands
 * @param workflowCommands Commands provided by the current workflow
 * @returns Combined list of all available commands
 */
export function getAllAvailableCommands(
  workflowCommands: Record<
    string,
    { description: string; handler: (args?: string) => Promise<void> | void }
  > = {},
): Array<SlashCommand> {
  const workflowSlashCommands: Array<SlashCommand> = Object.entries(
    workflowCommands,
  ).map(([commandName, commandConfig]) => ({
    command: `/${commandName}`,
    description: commandConfig.description,
    source: "workflow" as const,
  }));

  return [...DEFAULT_UI_COMMANDS, ...workflowSlashCommands];
}

// Legacy export for backward compatibility
export const SLASH_COMMANDS = DEFAULT_UI_COMMANDS;
