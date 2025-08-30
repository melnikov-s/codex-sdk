import { describe, it, expect } from "vitest";
import React from "react";
import { Box, Text } from "ink";
import { renderTui } from "./ui-test-helpers";
import {
  HotkeyProvider,
  useHotkeyConfig,
  defaultHotkeyConfig,
  type CustomizableHotkeyConfig,
} from "../src/hooks/use-customizable-hotkeys";

// Test component to consume the hotkey context
function TestConsumer() {
  const { config } = useHotkeyConfig();

  return (
    <Box flexDirection="column">
      <Text>Previous: {config.previousWorkflow.key}</Text>
      <Text>Next: {config.nextWorkflow.key}</Text>
      <Text>Commands: {config.appCommands.key}</Text>
      <Text>Update</Text>
    </Box>
  );
}

describe("Customizable Hotkeys", () => {
  describe("HotkeyProvider", () => {
    it("provides default configuration when no initial config is given", () => {
      const { lastFrameStripped } = renderTui(
        <HotkeyProvider>
          <TestConsumer />
        </HotkeyProvider>,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Previous: o");
      expect(output).toContain("Next: p");
      expect(output).toContain("Commands: k");
    });

    it("applies initial configuration when provided", () => {
      const customConfig: Partial<CustomizableHotkeyConfig> = {
        previousWorkflow: { key: "h", ctrl: true },
        nextWorkflow: { key: "l", ctrl: true },
      };

      const { lastFrameStripped } = renderTui(
        <HotkeyProvider initialConfig={customConfig}>
          <TestConsumer />
        </HotkeyProvider>,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Previous: h");
      expect(output).toContain("Next: l");

      expect(output).toContain("Commands: k"); // Still default
    });

    it("merges partial configuration with defaults", () => {
      const partialConfig: Partial<CustomizableHotkeyConfig> = {
        appCommands: { key: "k", ctrl: true, shift: true },
      };

      const { lastFrameStripped } = renderTui(
        <HotkeyProvider initialConfig={partialConfig}>
          <TestConsumer />
        </HotkeyProvider>,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Previous: o"); // Default
      expect(output).toContain("Next: p"); // Default
      expect(output).toContain("Commands: k"); // Uses default since we're testing partial merge
    });
  });

  describe("useHotkeyConfig", () => {
    it("returns the current configuration", () => {
      const TestComponent = () => {
        const { config } = useHotkeyConfig();
        return <Text>{JSON.stringify(config)}</Text>;
      };

      const { lastFrameStripped } = renderTui(
        <HotkeyProvider>
          <TestComponent />
        </HotkeyProvider>,
      );

      const output = lastFrameStripped();
      expect(output).toContain('"key":"o"');
      expect(output).toContain('"ctrl":true');
    });

    it("allows updating configuration", async () => {
      const TestComponent = () => {
        const { config, updateConfig } = useHotkeyConfig();

        React.useEffect(() => {
          updateConfig({
            previousWorkflow: { key: "x", ctrl: true, shift: true },
          });
        }, [updateConfig]);

        return (
          <Box flexDirection="column">
            <Text>Key: {config.previousWorkflow.key}</Text>
            <Text>Ctrl: {config.previousWorkflow.ctrl ? "true" : "false"}</Text>
            <Text>
              Shift: {config.previousWorkflow.shift ? "true" : "false"}
            </Text>
          </Box>
        );
      };

      const { lastFrameStripped, flush } = renderTui(
        <HotkeyProvider>
          <TestComponent />
        </HotkeyProvider>,
      );

      await flush();

      const output = lastFrameStripped();
      expect(output).toContain("Key: x");
      expect(output).toContain("Ctrl: true");
      expect(output).toContain("Shift: true");
    });
  });

  describe("defaultHotkeyConfig", () => {
    it("has correct default values", () => {
      expect(defaultHotkeyConfig.previousWorkflow).toEqual({
        key: "o",
        ctrl: true,
      });
      expect(defaultHotkeyConfig.nextWorkflow).toEqual({
        key: "p",
        ctrl: true,
      });

      expect(defaultHotkeyConfig.appCommands).toEqual({
        key: "k",
        ctrl: true,
      });
    });
  });

  describe("type safety", () => {
    it("accepts valid partial configurations", () => {
      const validConfigs: Array<Partial<CustomizableHotkeyConfig>> = [
        {},
        { previousWorkflow: { key: "h" } },
        { nextWorkflow: { key: "l", ctrl: true } },
        { appCommands: { key: "k", ctrl: true, shift: true } },
        {
          previousWorkflow: { key: "h", ctrl: true },
          nextWorkflow: { key: "l", ctrl: true },
        },
      ];

      validConfigs.forEach((config) => {
        expect(() => {
          renderTui(
            <HotkeyProvider initialConfig={config}>
              <TestConsumer />
            </HotkeyProvider>,
          );
        }).not.toThrow();
      });
    });
  });
});
