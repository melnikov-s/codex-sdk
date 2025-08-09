// minimal-agent.js
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { run, createAgentWorkflow } from "codex-sdk";

const workflow = createAgentWorkflow(
  ({ state, setState, addMessage, handleModelResult, tools }) => {
    return {
      // Set an initial "Ready" message
      initialize: async () => {
        setState({ messages: [{ role: "ui", content: "Ready." }] });
      },
      // This is the core loop, called on every user input
      message: async (userInput) => {
        addMessage(userInput);
        setState({ loading: true });

        const result = await generateText({
          model: openai("gpt-4o"),
          system: "You are a helpful assistant.",
          messages: state.transcript, // transcript conveniently excludes UI messages
          tools,
        });

        // handleModelResult adds the AI response, executes tools,
        // and adds tool results to the message history automatically.
        await handleModelResult(result);

        setState({ loading: false });
      },
      // Cleanup methods for user interruption
      stop: () => setState({ loading: false }),
      terminate: () => setState({ loading: false, messages: [] }),
    };
  },
);

run(workflow);
