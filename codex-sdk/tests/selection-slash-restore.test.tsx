import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderTui } from "./ui-test-helpers";
import TerminalChat from "../src/components/chat/terminal-chat";

// Mock the input utils to avoid filesystem operations
vi.mock("../src/utils/input-utils.js", () => ({
  createInputItem: vi.fn(async (text: string) => ({
    role: "user",
    type: "message",
    content: [{ type: "input_text", text }],
  })),
}));

// Helper to type text and flush
async function type(
  stdin: NodeJS.WritableStream,
  text: string,
  flush: () => Promise<void>,
) {
  stdin.write(text);
  await flush();
}

// Minimal workflow factory for testing
function makeWorkflowFactory(title = "Test Workflow") {
  return Object.assign(
    () => ({
      message: () => {},
      stop: () => {},
      terminate: () => {},
    }),
    { title },
  );
}

describe("selection → slash → restore behavior", () => {
  it("DEBUG: step by step character input", async () => {
    const available = [
      makeWorkflowFactory("Workflow One"),
      makeWorkflowFactory("Workflow Two"),
    ];
    const { lastFrameStripped: _lastFrameStripped, flush, stdin, cleanup } = renderTui(
      <TerminalChat
        multiWorkflow
        availableWorkflows={available as any}
        approvalPolicy="suggest"
        additionalWritableRoots={[]}
        fullStdout={false}
      />,
    );

    // Setup: Create two workflows and open switcher
    await type(stdin, "\r", flush);
    await flush();
    stdin.write("\x0F");
    await flush();
    await type(stdin, "\r", flush);
    await flush();
    stdin.write("\x0F");
    await flush();

    // Step 1: Press "/"
    await type(stdin, "/", flush);

    // Step 2: Press "s"
    await type(stdin, "s", flush);

    // Step 3: Press "w"
    await type(stdin, "w", flush);

    cleanup();
  });

  it("Delete slash restoration: user_select → / → delete → should restore selection", async () => {
    const available = [
      makeWorkflowFactory("Workflow One"),
      makeWorkflowFactory("Workflow Two"),
    ];
    const { lastFrameStripped, flush, stdin, cleanup } = renderTui(
      <TerminalChat
        multiWorkflow
        availableWorkflows={available as any}
        approvalPolicy="suggest"
        additionalWritableRoots={[]}
        fullStdout={false}
      />,
    );

    // Helper function to type characters
    const type = async (stdin: any, text: string, flush: any) => {
      for (const char of text) {
        stdin.write(char);
        await flush();
      }
    };

    await flush();

    // Step 1: Create first workflow
    await type(stdin, "\r", flush);
    await flush();

    let frame = lastFrameStripped();

    // Step 2: Create second workflow
    await type(stdin, "\r", flush);
    await flush();

    frame = lastFrameStripped();

    // Step 3: Open workflow switcher with Ctrl+O
    stdin.write("\u000F"); // Ctrl+O
    await flush();

    frame = lastFrameStripped();

    // Step 4: Press "/" to enter slash mode
    await type(stdin, "/", flush);
    await flush();

    frame = lastFrameStripped();

    // Step 5: Delete the "/" (should restore original selection)
    stdin.write("\u007F"); // Backspace/Delete
    await flush();

    frame = lastFrameStripped();

    // Check that selection is restored
    const hasSelectionOverlay =
      frame.includes("Switch workflow") &&
      frame.includes("❯") &&
      frame.includes("↵ to select");

    expect(hasSelectionOverlay).toBe(true);

    cleanup();
  });

  it("ACTUAL BUG REPRODUCTION: user_select → / → /switch → escape should restore selection or show /", async () => {
    const available = [
      makeWorkflowFactory("Workflow One"),
      makeWorkflowFactory("Workflow Two"),
    ];
    const { lastFrameStripped, flush, stdin, cleanup } = renderTui(
      <TerminalChat
        multiWorkflow
        availableWorkflows={available as any}
        approvalPolicy="suggest"
        additionalWritableRoots={[]}
        fullStdout={false}
      />,
    );

    // Step 1: Create initial workflow (launcher shows first)
    await type(stdin, "\r", flush);
    await flush();

    // Step 1b: Create second workflow so we have multiple to switch between
    stdin.write("\x0F"); // Ctrl+O to open launcher again
    await flush();
    await type(stdin, "\r", flush); // Create second workflow
    await flush();

    // Step 2: Now open the workflow switcher (Ctrl+O) - should show a real switcher now
    stdin.write("\x0F"); // Ctrl+O
    await flush();

    let frame = lastFrameStripped();

    // Should see the workflow picker/selection with multiple workflows
    const hasSelection =
      frame.includes("Switch workflow") ||
      frame.includes("Workflow One") ||
      frame.includes("Workflow Two") ||
      frame.includes("▶"); // Active workflow indicator
    expect(hasSelection).toBe(true);

    // Step 3: Press "/" to enter slash mode
    await type(stdin, "/", flush);
    await flush();

    frame = lastFrameStripped();

    // Step 4: Type "switch" to complete "/switch"
    await type(stdin, "switch", flush);
    await flush();

    frame = lastFrameStripped();

    // Step 5: Press Enter to execute /switch (should open switcher overlay)
    await type(stdin, "\r", flush);
    await flush();

    frame = lastFrameStripped();

    // Step 6: Press Escape to cancel switcher
    await type(stdin, "\x1B", flush);
    await flush();

    frame = lastFrameStripped();

    const hasSelectionOverlay =
      frame.includes("Switch workflow") &&
      frame.includes("❯") &&
      frame.includes("↵ to select");

    const hasSlashInput =
      frame.includes("│ /") &&
      (frame.includes("/clearhistory") || frame.includes("/switch")) &&
      !frame.includes("Switch workflow");

    const isFixed = hasSelectionOverlay || hasSlashInput;

    expect(isFixed).toBe(true);

    cleanup();
  });
});
