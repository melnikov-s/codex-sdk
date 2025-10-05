import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { run, createAgentWorkflow } from "codex-sdk";

const workflow = createAgentWorkflow(
  "Hello World",
  ({ state, actions, tools }) => {
    return {
      initialize: async () => {
        actions.say("👋 Hello! I'm a simple assistant. Ask me anything!");
      },

      message: async (userInput) => {
        actions.setLoading(true);
        actions.addMessage(userInput);

        const result = await generateText({
          model: openai("gpt-5"),
          system:
            "You are a friendly assistant. Keep responses concise and helpful.",
          messages: state.transcript,
          tools: tools.definitions,
        });

        await actions.handleModelResult(result);
        actions.setLoading(false);
      },

      stop: () => actions.setLoading(false),
      terminate: () => {},
    };
  },
);

if (import.meta.url === `file://${process.argv[1]}`) {
  run(workflow);
}
