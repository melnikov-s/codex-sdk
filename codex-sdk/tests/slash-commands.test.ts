import { test, expect } from "vitest";
import {
  DEFAULT_UI_COMMANDS,
  getAllAvailableCommands,
  type SlashCommand,
} from "../src/utils/slash-commands";

test("DEFAULT_UI_COMMANDS includes expected commands", () => {
  const commands = DEFAULT_UI_COMMANDS.map((c: SlashCommand) => c.command);
  expect(commands).toContain("/history");
  expect(commands).toContain("/help");
  expect(commands).toContain("/approval");
  expect(commands).toContain("/clearhistory");

  expect(commands).not.toContain("/diff"); // Now a workflow command
  expect(commands).not.toContain("/compact");
  expect(commands).not.toContain("/model");
  expect(commands).not.toContain("/bug");
});

test("getAllAvailableCommands combines UI and workflow commands", () => {
  const workflowCommands = {
    compact: {
      description: "Clear conversation history but keep a summary in context",
      handler: async () => {},
    },
    diff: {
      description: "Show the current git diff of modified files",
      handler: async () => {},
    },
    custom: {
      description: "A custom workflow command",
      handler: async () => {},
    },
  };

  const allCommands = getAllAvailableCommands(workflowCommands);
  const commandNames = allCommands.map((c: SlashCommand) => c.command);

  expect(commandNames).toContain("/help");

  expect(commandNames).toContain("/compact");
  expect(commandNames).toContain("/diff");
  expect(commandNames).toContain("/custom");

  const compactCommand = allCommands.find((c) => c.command === "/compact");
  const customCommand = allCommands.find((c) => c.command === "/custom");

  expect(compactCommand?.description).toBe(
    "Clear conversation history but keep a summary in context",
  );
  expect(customCommand?.description).toBe("A custom workflow command");

  const uiCommands = allCommands.filter((c) => c.source === "ui");
  const workflowCmds = allCommands.filter((c) => c.source === "workflow");

  expect(uiCommands.length).toBeGreaterThan(0);
  expect(workflowCmds.length).toBe(3); // compact, diff, custom
});

test("filters commands by prefix", () => {
  const workflowCommands = {
    compact: {
      description: "Clear conversation history but keep a summary in context",
      handler: async () => {},
    },
  };
  const allCommands = getAllAvailableCommands(workflowCommands);

  const prefix = "/c";
  const filtered = allCommands.filter((c: SlashCommand) =>
    c.command.startsWith(prefix),
  );
  const names = filtered.map((c: SlashCommand) => c.command);
  expect(names).toEqual(expect.arrayContaining(["/clearhistory", "/compact"]));
  expect(names).not.toEqual(
    expect.arrayContaining(["/history", "/help", "/approval"]),
  );
});

test("excludes disabled commands from the list", () => {
  const workflowCommands = {
    enabled: {
      description: "This command is enabled",
      handler: async () => {},
    },
    conditionallyDisabled: {
      description: "This command is conditionally disabled",
      handler: async () => {},
      disabled: () => true,
    },
    conditionallyEnabled: {
      description: "This command is conditionally enabled",
      handler: async () => {},
      disabled: () => false,
    },
  };

  const allCommands = getAllAvailableCommands(workflowCommands);
  const commandNames = allCommands.map((c: SlashCommand) => c.command);

  // Should include enabled commands
  expect(commandNames).toContain("/enabled");
  expect(commandNames).toContain("/conditionallyEnabled");

  // Should exclude disabled commands
  expect(commandNames).not.toContain("/conditionallyDisabled");
});

test("handles disabled property edge cases", () => {
  const workflowCommands = {
    undefinedDisabled: {
      description: "Command with undefined disabled",
      handler: async () => {},
      disabled: undefined,
    },
    explicitlyEnabled: {
      description: "Command explicitly enabled",
      handler: async () => {},
      disabled: () => false,
    },
  };

  const allCommands = getAllAvailableCommands(workflowCommands);
  const commandNames = allCommands.map((c: SlashCommand) => c.command);

  // Both should be included (undefined and function returning false should show the command)
  expect(commandNames).toContain("/undefinedDisabled");
  expect(commandNames).toContain("/explicitlyEnabled");
});
