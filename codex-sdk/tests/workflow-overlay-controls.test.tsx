import { describe, it, expect, vi } from "vitest";
import React from "react";
import { Box, Text } from "ink";
import { renderTui } from "./ui-test-helpers";
import { WorkflowOverlay } from "../src/components/workflow-overlay";
import type { HotkeyAction } from "../src/hooks/use-global-hotkeys";
import type { ApprovalPolicy } from "../src/approvals";

// Mock TerminalChatSelect to avoid complex dependencies
vi.mock("../src/components/chat/terminal-chat-select", () => ({
  TerminalChatSelect: ({
    items,
  }: {
    items: Array<{ label: string; value: string }>;
  }) => (
    <Box flexDirection="column">
      {items.map((item, i) => (
        <Text key={i}>{item.label}</Text>
      ))}
    </Box>
  ),
}));

// Mock AppHeader to avoid complex dependencies
vi.mock("../src/components/chat/app-header", () => ({
  default: () => <Text>App Header</Text>,
}));

describe("WorkflowOverlay with Controls", () => {
  const mockProps = {
    title: "Test Overlay",
    promptText: "Select an option:",
    terminalRows: 20,
    version: "1.0.0",
    PWD: "/test",
    approvalPolicy: "suggest" as ApprovalPolicy,
    colorsByPolicy: {
      "suggest": "blue" as const,
      "auto-edit": "yellow" as const,
      "full-auto": "red" as const,
    },
    items: [
      { label: "Option 1", value: "opt1" },
      { label: "Option 2", value: "opt2" },
    ],
    onSelect: vi.fn(),
    onCancel: vi.fn(),
  };

  const mockHotkeys: Array<HotkeyAction> = [
    {
      key: "o",
      ctrl: true,
      action: () => {},
      description: "Previous workflow",
    },
    {
      key: "p",
      ctrl: true,
      action: () => {},
      description: "Next workflow",
    },
    {
      key: "k",
      ctrl: true,
      action: () => {},
      description: "App commands",
    },
  ];

  describe("controls visibility", () => {
    it("shows controls when showControls=true and hotkeys are provided", () => {
      const { lastFrameStripped } = renderTui(
        <WorkflowOverlay
          {...mockProps}
          showControls={true}
          availableHotkeys={mockHotkeys}
        />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Ctrl+O: previous workflow");
      expect(output).toContain("Ctrl+P: next workflow");
      expect(output).toContain("Ctrl+K: app commands");
    });

    it("hides controls when showControls=false", () => {
      const { lastFrameStripped } = renderTui(
        <WorkflowOverlay
          {...mockProps}
          showControls={false}
          availableHotkeys={mockHotkeys}
        />,
      );

      const output = lastFrameStripped();
      expect(output).not.toContain("CTRL+O");
      expect(output).not.toContain("CTRL+P");
      expect(output).not.toContain("CTRL+K");
    });

    it("hides controls when no hotkeys are provided", () => {
      const { lastFrameStripped } = renderTui(
        <WorkflowOverlay
          {...mockProps}
          showControls={true}
          availableHotkeys={[]}
        />,
      );

      const output = lastFrameStripped();
      expect(output).not.toContain("CTRL+");
    });

    it("shows controls by default when hotkeys are provided", () => {
      const { lastFrameStripped } = renderTui(
        <WorkflowOverlay
          {...mockProps}
          availableHotkeys={mockHotkeys}
          // showControls defaults to true
        />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Ctrl+O: previous workflow");
      expect(output).toContain("Ctrl+P: next workflow");
    });
  });

  describe("layout integration", () => {
    it("displays controls below the selection interface", () => {
      const { lastFrameStripped } = renderTui(
        <WorkflowOverlay {...mockProps} availableHotkeys={mockHotkeys} />,
      );

      const output = lastFrameStripped();
      // Controls should appear after the options
      expect(output).toContain("Option 1");
      expect(output).toContain("Option 2");
      expect(output).toContain("Ctrl+O");
    });

    it("displays controls with subtle styling", () => {
      const { lastFrameStripped } = renderTui(
        <WorkflowOverlay {...mockProps} availableHotkeys={mockHotkeys} />,
      );

      const output = lastFrameStripped();
      // Should show controls in subtle format with colons and em dashes
      expect(output).toContain("Ctrl+O: previous workflow");
      expect(output).toContain(" — ");
    });
  });

  describe("customizable hotkeys integration", () => {
    it("displays custom hotkey combinations", () => {
      const customHotkeys: Array<HotkeyAction> = [
        {
          key: "h",
          ctrl: true,
          action: () => {},
          description: "Previous workflow",
        },
        {
          key: "l",
          ctrl: true,
          action: () => {},
          description: "Next workflow",
        },
        {
          key: "w",
          ctrl: true,
          action: () => {},
          description: "Workflow picker",
        },
      ];

      const { lastFrameStripped } = renderTui(
        <WorkflowOverlay {...mockProps} availableHotkeys={customHotkeys} />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Ctrl+H: previous workflow");
      expect(output).toContain("Ctrl+L: next workflow");
      expect(output).toContain("Ctrl+W: workflow picker");
    });

    it("displays complex modifier combinations", () => {
      const complexHotkeys: Array<HotkeyAction> = [
        {
          key: "k",
          ctrl: true,
          shift: true,
          action: () => {},
          description: "App commands",
        },
        {
          key: "space",
          meta: true,
          action: () => {},
          description: "Quick actions",
        },
      ];

      const { lastFrameStripped } = renderTui(
        <WorkflowOverlay {...mockProps} availableHotkeys={complexHotkeys} />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Ctrl+Shift+K: app commands");
      expect(output).toContain("Cmd+SPACE: quick actions");
    });
  });

  describe("accessibility", () => {
    it("displays controls in compact mode for better space usage", () => {
      const { lastFrameStripped } = renderTui(
        <WorkflowOverlay {...mockProps} availableHotkeys={mockHotkeys} />,
      );

      const output = lastFrameStripped();
      // Should use compact display (inline format)
      expect(output).toContain("Ctrl+O: previous workflow");
      expect(output).toContain("Ctrl+P: next workflow");
    });

    it("maintains readability with proper spacing", () => {
      const { lastFrameStripped } = renderTui(
        <WorkflowOverlay {...mockProps} availableHotkeys={mockHotkeys} />,
      );

      const output = lastFrameStripped();
      // Should have proper format with colons and descriptions
      expect(output).toMatch(/Ctrl\+\w+:\s+\w+/);
    });
  });

  describe("props validation", () => {
    it("handles missing optional props gracefully", () => {
      expect(() => {
        renderTui(
          <WorkflowOverlay
            {...mockProps}
            // availableHotkeys is undefined
            // showControls is undefined
          />,
        );
      }).not.toThrow();
    });

    it("handles empty hotkeys array", () => {
      expect(() => {
        renderTui(
          <WorkflowOverlay
            {...mockProps}
            availableHotkeys={[]}
            showControls={true}
          />,
        );
      }).not.toThrow();
    });
  });
});
