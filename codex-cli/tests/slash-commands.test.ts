import { test, expect } from "vitest";
import {
  DEFAULT_UI_COMMANDS,
  getAllAvailableCommands,
  type SlashCommand,
} from "../src/utils/slash-commands";

test("DEFAULT_UI_COMMANDS includes expected commands", () => {
  const commands = DEFAULT_UI_COMMANDS.map((c: SlashCommand) => c.command);
  expect(commands).toContain("/clear");
  expect(commands).toContain("/history");
  expect(commands).toContain("/help");
  expect(commands).toContain("/approval");
  expect(commands).toContain("/clearhistory");
  expect(commands).toContain("/diff");

  // These commands should NOT be in the default UI commands
  expect(commands).not.toContain("/compact"); // Now a workflow command
  expect(commands).not.toContain("/model"); // Removed
  expect(commands).not.toContain("/bug"); // Removed
  expect(commands).not.toContain("/mcp"); // Removed
});

test("getAllAvailableCommands combines UI and workflow commands", () => {
  const workflowCommands = {
    compact: {
      description: "Clear conversation history but keep a summary in context",
      handler: async () => {},
    },
    custom: {
      description: "A custom workflow command",
      handler: async () => {},
    },
  };

  const allCommands = getAllAvailableCommands(workflowCommands);
  const commandNames = allCommands.map((c: SlashCommand) => c.command);

  // Should include UI commands
  expect(commandNames).toContain("/clear");
  expect(commandNames).toContain("/help");

  // Should include workflow commands
  expect(commandNames).toContain("/compact");
  expect(commandNames).toContain("/custom");

  // Check descriptions are set correctly
  const compactCommand = allCommands.find((c) => c.command === "/compact");
  const customCommand = allCommands.find((c) => c.command === "/custom");

  expect(compactCommand?.description).toBe(
    "Clear conversation history but keep a summary in context",
  );
  expect(customCommand?.description).toBe("A custom workflow command");

  // Check sources are set correctly
  const uiCommands = allCommands.filter((c) => c.source === "ui");
  const workflowCmds = allCommands.filter((c) => c.source === "workflow");

  expect(uiCommands.length).toBeGreaterThan(0);
  expect(workflowCmds.length).toBe(2);
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
  expect(names).toEqual(
    expect.arrayContaining(["/clear", "/clearhistory", "/compact"]),
  );
  expect(names).not.toEqual(
    expect.arrayContaining(["/history", "/help", "/approval"]),
  );
});
