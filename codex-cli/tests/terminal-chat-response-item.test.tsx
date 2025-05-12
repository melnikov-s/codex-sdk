import { renderTui } from "./ui-test-helpers.js";
import TerminalChatResponseItem from "../src/components/chat/terminal-chat-response-item.js";
import React from "react";
import { describe, it, expect } from "vitest";

function userMessage(text: string) {
  return {
    role: "user",
    content: text,
  } as const;
}

function assistantMessage(text: string) {
  return {
    role: "assistant",
    content: text,
  } as const;
}

describe("TerminalChatResponseItem", () => {
  it("renders a user message", () => {
    const { lastFrameStripped } = renderTui(
      <TerminalChatResponseItem item={userMessage("Hello world")} />,
    );

    const frame = lastFrameStripped();
    expect(frame).toContain("user");
    expect(frame).toContain("Hello world");
  });

  it("renders an assistant message", () => {
    const { lastFrameStripped } = renderTui(
      <TerminalChatResponseItem item={assistantMessage("Sure thing")} />,
    );

    const frame = lastFrameStripped();
    // assistant messages are labelled "codex" in the UI
    expect(frame.toLowerCase()).toContain("codex");
    expect(frame).toContain("Sure thing");
  });
});
