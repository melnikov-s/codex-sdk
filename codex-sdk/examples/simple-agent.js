// minimal-agent.js
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { run, createAgentWorkflow } from "codex-sdk";

export const workflow = createAgentWorkflow(
  "Simple Agent",
  ({ state, setState, actions, tools }) => {
    async function runAgentLoop() {
      actions.setLoading(true);
      while (state.loading) {
        const result = await generateText({
          model: openai("gpt-4o"),
          system: "You are a helpful assistant.",
          messages: state.transcript,
          tools: tools.definitions,
        });
        await actions.handleModelResult(result);
        if (result.finishReason === "stop") {
          actions.setLoading(false);
          break;
        }
      }
    }

    return {
      title: "Simple Agent",
      initialize: async () => {
        setState({ messages: [{ role: "ui", content: "Ready. Starting…" }] });
        runAgentLoop();
      },
      message: async (userInput) => {
        if (state.loading) {
          actions.addMessage(userInput);
          actions.say("💡 Received — will consider next turn.");
          return;
        }
        actions.addMessage(userInput);
        runAgentLoop();
      },
      stop: () => actions.setLoading(false),
      terminate: () => setState({ loading: false, messages: [] }),
    };
  },
);

// Run directly if this file is executed (not imported)
// eslint-disable-next-line no-undef
if (import.meta.url === `file://${process.argv[1]}`) {
  run(workflow);
}
