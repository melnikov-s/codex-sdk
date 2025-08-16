// coding-agent.js
// A simple coding agent that can read files, run commands, and propose patches.
// - Shows a role/instructions message in initialize
// - Starts the agent loop on first user message (not in initialize)
// - While running, new user messages are queued and processed turn-by-turn

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { run, createAgentWorkflow } from "codex-sdk";

const workflow = createAgentWorkflow(({ state, setState, actions, tools }) => {
  async function runAgentLoop() {
    actions.setLoading(true);

    while (state.loading) {
      // If messages were queued while we were busy, pull one and surface it to the transcript first
      const nextQueued = actions.removeFromQueue();
      if (nextQueued != null && nextQueued.trim().length > 0) {
        actions.addMessage({ role: "user", content: nextQueued });
      }

      const result = await generateText({
        model: openai("gpt-4o"),
        system: `You are a local coding agent.
You can:
- Read files and run safe shell commands via the 'shell' tool
- Propose and apply code edits via the 'apply_patch' tool (subject to approval)
Be explicit and concise. Prefer small, verifiable steps.`,
        messages: state.transcript,
        tools: tools.definitions,
      });

      // Add assistant messages and execute any tools it requested
      await actions.handleModelResult(result);

      // Artificial delay to demonstrate the queue accepting inputs while busy
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Stop only if the model signalled completion AND there is nothing queued
      if (result.finishReason === "stop") {
        if ((state.queue?.length || 0) > 0) {
          // There is queued input; continue loop to surface it next turn
          continue;
        }
        actions.setLoading(false);
        break;
      }
    }
  }

  return {
    initialize: async () => {
      actions.say(
        "Coding agent ready. Describe what you want to change or ask a question.",
      );
    },

    // Start loop on first message. If already running, queue the message.
    message: async (userInput) => {
      if (state.loading) {
        actions.addToQueue(userInput.content || "");
        actions.say("⏳ Queued your request — finishing current step first...");
        return;
      }

      actions.addMessage(userInput);
      await runAgentLoop();
    },

    stop: () => actions.setLoading(false),
    terminate: () => setState({ loading: false, messages: [] }),
  };
});

run(workflow);


