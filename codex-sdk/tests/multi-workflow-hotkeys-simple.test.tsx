import { describe, it, expect, vi } from "vitest";
import React from "react";
import { Box, Text } from "ink";
import { renderTui } from "./ui-test-helpers";
import { useMultiWorkflowHotkeys } from "../src/hooks/use-multi-workflow-hotkeys";
import {
  HotkeyProvider,
  defaultHotkeyConfig,
  type CustomizableHotkeyConfig,
} from "../src/hooks/use-customizable-hotkeys";

// Mock useGlobalHotkeys since we're testing the configuration logic
vi.mock("../src/hooks/use-global-hotkeys", () => ({
  useGlobalHotkeys: vi.fn(),
  HotkeyPatterns: {
    ctrlTab: (action: () => void) => ({
      key: "tab",
      ctrl: true,
      action,
      description: "Ctrl+Tab",
    }),
    ctrlShiftTab: (action: () => void) => ({
      key: "tab",
      ctrl: true,
      shift: true,
      action,
      description: "Ctrl+Shift+Tab",
    }),
  },
}));

describe("Multi-Workflow Hotkeys Integration", () => {
  const mockParams = {
    workflows: [{ id: "workflow1", title: "Workflow 1" }],
    activeWorkflowId: "workflow1",
    switchToWorkflow: vi.fn(),
    switchToNextWorkflow: vi.fn(),
    switchToPreviousWorkflow: vi.fn(),
    switchToNextAttention: vi.fn(() => false),
    switchToNextNonLoading: vi.fn(),
    openWorkflowPicker: vi.fn(),
    createNewWorkflow: vi.fn(),
    killCurrentWorkflow: vi.fn(),
    emergencyExit: vi.fn(),
    enabled: true,
  };

  describe("default configuration", () => {
    it("has correct default values", () => {
      expect(defaultHotkeyConfig.previousWorkflow).toEqual({
        key: "o",
        ctrl: true,
      });
      expect(defaultHotkeyConfig.nextWorkflow).toEqual({
        key: "p",
        ctrl: true,
      });
      expect(defaultHotkeyConfig.nextNonLoading).toEqual({
        key: "n",
        ctrl: true,
      });
    });

    it("uses default hotkeys when no custom config is provided", () => {
      const TestComponent = () => {
        const { hotkeys } = useMultiWorkflowHotkeys(mockParams);

        const previousHotkey = hotkeys.find(
          (h) => h.action === mockParams.switchToPreviousWorkflow,
        );
        const nextHotkey = hotkeys.find(
          (h) => h.action === mockParams.switchToNextWorkflow,
        );
        const nextNonLoadingHotkey = hotkeys.find(
          (h) => h.action === mockParams.switchToNextNonLoading,
        );

        return (
          <Box flexDirection="column">
            <Text>Previous: {previousHotkey?.key}</Text>
            <Text>Next: {nextHotkey?.key}</Text>
            <Text>NextNonLoading: {nextNonLoadingHotkey?.key}</Text>
          </Box>
        );
      };

      const { lastFrameStripped } = renderTui(
        <HotkeyProvider>
          <TestComponent />
        </HotkeyProvider>,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Previous: o");
      expect(output).toContain("Next: p");
      expect(output).toContain("NextNonLoading: n");
    });
  });

  describe("custom configuration", () => {
    it("applies custom hotkey configuration", () => {
      const customConfig: Partial<CustomizableHotkeyConfig> = {
        previousWorkflow: { key: "h", ctrl: true },
        nextWorkflow: { key: "l", ctrl: true },
      };

      const TestComponent = () => {
        const { hotkeys } = useMultiWorkflowHotkeys(mockParams);

        const previousHotkey = hotkeys.find(
          (h) => h.action === mockParams.switchToPreviousWorkflow,
        );
        const nextHotkey = hotkeys.find(
          (h) => h.action === mockParams.switchToNextWorkflow,
        );

        return (
          <Box flexDirection="column">
            <Text>Previous: {previousHotkey?.key}</Text>
            <Text>Next: {nextHotkey?.key}</Text>
          </Box>
        );
      };

      const { lastFrameStripped } = renderTui(
        <HotkeyProvider initialConfig={customConfig}>
          <TestComponent />
        </HotkeyProvider>,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Previous: h");
      expect(output).toContain("Next: l");
    });

    it("merges partial configuration with defaults", () => {
      const partialConfig: Partial<CustomizableHotkeyConfig> = {
        previousWorkflow: { key: "h", ctrl: true },
        // nextWorkflow should use defaults
      };

      const TestComponent = () => {
        const { hotkeys } = useMultiWorkflowHotkeys(mockParams);

        const previousHotkey = hotkeys.find(
          (h) => h.action === mockParams.switchToPreviousWorkflow,
        );
        const nextHotkey = hotkeys.find(
          (h) => h.action === mockParams.switchToNextWorkflow,
        );

        return (
          <Box flexDirection="column">
            <Text>Previous: {previousHotkey?.key}</Text>
            <Text>Next: {nextHotkey?.key}</Text>
          </Box>
        );
      };

      const { lastFrameStripped } = renderTui(
        <HotkeyProvider initialConfig={partialConfig}>
          <TestComponent />
        </HotkeyProvider>,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Previous: h"); // Custom
      expect(output).toContain("Next: p"); // Default
    });
  });

  describe("hotkey return value", () => {
    it("returns hotkeys array and enabled state", () => {
      const TestComponent = () => {
        const result = useMultiWorkflowHotkeys(mockParams);

        return (
          <Box flexDirection="column">
            <Text>
              Has hotkeys: {Array.isArray(result.hotkeys) ? "yes" : "no"}
            </Text>
            <Text>Enabled: {result.isEnabled ? "yes" : "no"}</Text>
            <Text>Count: {result.hotkeys.length}</Text>
          </Box>
        );
      };

      const { lastFrameStripped } = renderTui(
        <HotkeyProvider>
          <TestComponent />
        </HotkeyProvider>,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Has hotkeys: yes");
      expect(output).toContain("Enabled: yes");
      expect(output).toContain("Count:");
    });
  });

  describe("nextNonLoading hotkey", () => {
    it("includes nextNonLoading hotkey when switchToNextNonLoading is provided", () => {
      const TestComponent = () => {
        const { hotkeys } = useMultiWorkflowHotkeys(mockParams);

        const nextNonLoadingHotkey = hotkeys.find(
          (h) => h.action === mockParams.switchToNextNonLoading,
        );

        return (
          <Box flexDirection="column">
            <Text>
              NextNonLoading key: {nextNonLoadingHotkey?.key || "none"}
            </Text>
            <Text>
              NextNonLoading description:{" "}
              {nextNonLoadingHotkey?.description || "none"}
            </Text>
          </Box>
        );
      };

      const { lastFrameStripped } = renderTui(
        <HotkeyProvider>
          <TestComponent />
        </HotkeyProvider>,
      );

      const output = lastFrameStripped();
      expect(output).toContain("NextNonLoading key: n");
      expect(output).toContain(
        "NextNonLoading description: Next non-loading workflow",
      );
    });

    it("omits nextNonLoading hotkey when switchToNextNonLoading is not provided", () => {
      const paramsWithoutNextNonLoading = {
        ...mockParams,
        switchToNextNonLoading: undefined,
      };

      const TestComponent = () => {
        const { hotkeys } = useMultiWorkflowHotkeys(
          paramsWithoutNextNonLoading,
        );

        const nextNonLoadingHotkey = hotkeys.find(
          (h) => h.description === "Next non-loading workflow",
        );

        return (
          <Box flexDirection="column">
            <Text>
              NextNonLoading found: {nextNonLoadingHotkey ? "yes" : "no"}
            </Text>
          </Box>
        );
      };

      const { lastFrameStripped } = renderTui(
        <HotkeyProvider>
          <TestComponent />
        </HotkeyProvider>,
      );

      const output = lastFrameStripped();
      expect(output).toContain("NextNonLoading found: no");
    });

    it("uses custom configuration for nextNonLoading hotkey", () => {
      const customConfig: Partial<CustomizableHotkeyConfig> = {
        nextNonLoading: { key: "j", ctrl: true },
      };

      const TestComponent = () => {
        const { hotkeys } = useMultiWorkflowHotkeys(mockParams);

        const nextNonLoadingHotkey = hotkeys.find(
          (h) => h.action === mockParams.switchToNextNonLoading,
        );

        return (
          <Box flexDirection="column">
            <Text>
              NextNonLoading key: {nextNonLoadingHotkey?.key || "none"}
            </Text>
          </Box>
        );
      };

      const { lastFrameStripped } = renderTui(
        <HotkeyProvider initialConfig={customConfig}>
          <TestComponent />
        </HotkeyProvider>,
      );

      const output = lastFrameStripped();
      expect(output).toContain("NextNonLoading key: j");
    });
  });
});
