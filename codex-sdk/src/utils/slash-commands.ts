// Defines the available slash commands and their descriptions.
// Used for autocompletion in the chat input.
export interface SlashCommand {
  command: string;
  description: string;
  source?: "ui" | "workflow";
}

export const DEFAULT_UI_COMMANDS: Array<SlashCommand> = [
  {
    command: "/clearhistory",
    description: "Clear command history",
    source: "ui",
  },
  { command: "/history", description: "Open command history", source: "ui" },
  { command: "/help", description: "Show list of commands", source: "ui" },
];

/**
 * Combine default UI commands with workflow-provided commands
 * @param workflowCommands Commands provided by the current workflow
 * @returns Combined list of all available commands (excluding disabled ones)
 */
export function getAllAvailableCommands(
  workflowCommands: Record<
    string,
    {
      description: string;
      handler: (args?: string) => Promise<void> | void;
      disabled?: () => boolean;
    }
  > = {},
): Array<SlashCommand> {
  const workflowSlashCommands: Array<SlashCommand> = Object.entries(
    workflowCommands,
  )
    .filter(([, commandConfig]) => {
      const disabled = commandConfig.disabled;
      if (disabled === undefined) {
        return true;
      }
      return !disabled();
    })
    .map(([commandName, commandConfig]) => ({
      command: `/${commandName}`,
      description: commandConfig.description,
      source: "workflow" as const,
    }));

  return [...DEFAULT_UI_COMMANDS, ...workflowSlashCommands];
}
