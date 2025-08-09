import React from "react";
import type { ComponentProps } from "react";
import { renderTui } from "./ui-test-helpers.js";
import TerminalChatInput from "../src/components/chat/terminal-chat-input.js";
import { describe, it, expect } from "vitest";

describe("TerminalChatInput compact command", () => {
  it("shows statusLine when provided", async () => {
    const props: ComponentProps<typeof TerminalChatInput> = {
      loading: false,
      queue: [],
      submitInput: () => {},
      confirmationPrompt: null,
      explanation: undefined,
      submitConfirmation: () => {},
      setItems: () => {},
      statusLine: "Custom status message",
      openOverlay: () => {},

      openApprovalOverlay: () => {},
      openHelpOverlay: () => {},
      interruptAgent: () => {},
      active: true,
    };
    const { lastFrameStripped } = renderTui(<TerminalChatInput {...props} />);
    const frame = lastFrameStripped();
    expect(frame).toContain("Custom status message");
  });
});
