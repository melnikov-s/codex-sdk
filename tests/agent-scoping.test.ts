import { describe, it, expect } from "vitest";
import { createAgentWorkflow } from "../src/lib.js";
import type { ModelMessage } from "ai";

// This test exercises the agent-scoping API surface without making network calls.
// We simulate model results and verify message attribution.

function fakeAssistantMessages(text: string): {
  response: { messages: Array<ModelMessage> };
} {
  return {
    response: {
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text }],
        } as ModelMessage,
      ],
    },
  } as const as { response: { messages: Array<ModelMessage> } };
}

describe("agent message scoping", () => {
  it("tags messages by agent and filters transcript per agent", async () => {
    let plannerId = "";
    let execId = "";

    const workflow = createAgentWorkflow("Agent Test", ({ actions }) => {
      return {
        initialize: async () => {
          const planner = actions.createAgent("Planner");
          const executor = actions.createAgent("Executor");
          plannerId = planner.id;
          execId = executor.id;

          planner.say("Planning…");
          await planner.handleModelResults(fakeAssistantMessages("Plan done"));

          executor.say("Executing…");
          await executor.handleModelResults(
            fakeAssistantMessages("Execute done"),
          );
        },
        message: () => {},
        stop: () => {},
        terminate: () => {},
      };
    });

    // Run single workflow headless via public API
    const { runHeadless } = await import("../src/headless/index.js");
    const controller = runHeadless(workflow, {});

    // Allow initialize() async work to complete
    await new Promise((r) => setTimeout(r, 0));

    // Inspect messages
    const state = controller.getState();

    const plannerMsgs = state.messages.filter(
      (m: any) => m.agentId === plannerId,
    );
    const execMsgs = state.messages.filter((m: any) => m.agentId === execId);

    expect(plannerMsgs.length).toBeGreaterThan(0);
    expect(execMsgs.length).toBeGreaterThan(0);

    // Ensure assistant messages were tagged to the right agent
    expect(
      plannerMsgs.some(
        (m: any) =>
          (Array.isArray(m.content)
            ? m.content.find((p: any) => p.type === "text")?.text
            : m.content) === "Plan done",
      ),
    ).toBe(true);
    expect(
      execMsgs.some(
        (m: any) =>
          (Array.isArray(m.content)
            ? m.content.find((p: any) => p.type === "text")?.text
            : m.content) === "Execute done",
      ),
    ).toBe(true);
  });
});
