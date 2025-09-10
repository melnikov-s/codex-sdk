import { describe, it, expect } from "vitest";
import React from "react";
import { renderTui } from "./ui-test-helpers";
import { ControlsDisplay } from "../src/components/controls-display";
import type { HotkeyAction } from "../src/hooks/use-global-hotkeys";

describe("ControlsDisplay", () => {
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
      shift: true,
      action: () => {},
      description: "App commands",
    },
  ];

  describe("key combination formatting", () => {
    it("formats simple ctrl+key combinations", () => {
      const hotkeys: Array<HotkeyAction> = [
        { key: "o", ctrl: true, action: () => {}, description: "Test" },
      ];

      const { lastFrameStripped } = renderTui(
        <ControlsDisplay hotkeys={hotkeys} />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Ctrl+O");
    });

    it("formats complex key combinations with multiple modifiers", () => {
      const hotkeys: Array<HotkeyAction> = [
        {
          key: "k",
          ctrl: true,
          shift: true,
          action: () => {},
          description: "Test",
        },
      ];

      const { lastFrameStripped } = renderTui(
        <ControlsDisplay hotkeys={hotkeys} />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Ctrl+Shift+K");
    });

    it("formats meta key combinations", () => {
      const hotkeys: Array<HotkeyAction> = [
        {
          key: "space",
          meta: true,
          action: () => {},
          description: "Test",
        },
      ];

      const { lastFrameStripped } = renderTui(
        <ControlsDisplay hotkeys={hotkeys} />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Cmd+SPACE");
    });

    it("formats combinations with all modifiers", () => {
      const hotkeys: Array<HotkeyAction> = [
        {
          key: "f",
          ctrl: true,
          meta: true,
          shift: true,
          action: () => {},
          description: "Test",
        },
      ];

      const { lastFrameStripped } = renderTui(
        <ControlsDisplay hotkeys={hotkeys} />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Ctrl+Cmd+Shift+F");
    });
  });

  describe("display modes", () => {
    it("renders in expanded mode by default", () => {
      const { lastFrameStripped } = renderTui(
        <ControlsDisplay hotkeys={mockHotkeys} />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Controls");
      expect(output).toContain("Ctrl+O");
      expect(output).toContain("Previous workflow");
      expect(output).toContain("Ctrl+P");
      expect(output).toContain("Next workflow");
      expect(output).toContain("Ctrl+Shift+K");
      expect(output).toContain("App commands");
    });

    it("renders in compact mode when specified", () => {
      const { lastFrameStripped } = renderTui(
        <ControlsDisplay hotkeys={mockHotkeys} compact />,
      );

      const output = lastFrameStripped();
      // In compact mode, should show hotkeys inline
      expect(output).toContain("Ctrl+O Previous workflow");
      expect(output).toContain("Ctrl+P Next workflow");
      expect(output).toContain("Ctrl+Shift+K App commands");
    });
  });

  describe("customization", () => {
    it("uses custom title when provided", () => {
      const { lastFrameStripped } = renderTui(
        <ControlsDisplay hotkeys={mockHotkeys} title="Custom Controls" />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Custom Controls");
    });

    it("handles empty hotkeys array", () => {
      const { lastFrameStripped } = renderTui(<ControlsDisplay hotkeys={[]} />);

      const output = lastFrameStripped();
      expect(output).toContain("Controls");
      // Should not crash and should show the title
    });

    it("handles hotkeys without descriptions", () => {
      const hotkeysWithoutDesc: Array<HotkeyAction> = [
        { key: "x", ctrl: true, action: () => {} },
      ];

      const { lastFrameStripped } = renderTui(
        <ControlsDisplay hotkeys={hotkeysWithoutDesc} />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Ctrl+X");
      // Should not crash when description is missing
    });
  });

  describe("accessibility", () => {
    it("displays hotkeys in uppercase for better readability", () => {
      const hotkeys: Array<HotkeyAction> = [
        { key: "enter", ctrl: true, action: () => {}, description: "Submit" },
      ];

      const { lastFrameStripped } = renderTui(
        <ControlsDisplay hotkeys={hotkeys} />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Ctrl+ENTER");
      expect(output).not.toContain("ctrl+enter");
    });

    it("shows clear separator between hotkey and description", () => {
      const { lastFrameStripped } = renderTui(
        <ControlsDisplay hotkeys={mockHotkeys} />,
      );

      const output = lastFrameStripped();
      expect(output).toContain("Ctrl+O");
      expect(output).toContain("Previous workflow");
      expect(output).toContain("Ctrl+P");
      expect(output).toContain("Next workflow");
    });
  });

  describe("layout", () => {
    it("maintains consistent spacing in expanded mode", () => {
      const { lastFrameStripped } = renderTui(
        <ControlsDisplay hotkeys={mockHotkeys} />,
      );

      const output = lastFrameStripped();
      // Should have consistent indentation and spacing
      expect(output).toMatch(/\s+Ctrl\+O/);
      expect(output).toMatch(/\s+Ctrl\+P/);
      expect(output).toMatch(/\s+Ctrl\+Shift\+K/);
    });
  });
});
