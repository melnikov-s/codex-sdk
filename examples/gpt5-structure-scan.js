import { run, createAgentWorkflow } from "../dist/lib.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

// Basic GPT‑5 structure scanning workflow
export const workflow = createAgentWorkflow(
  "GPT‑5 Structure Scan",
  ({ state, actions, tools }) => {
    async function runAgentLoop() {
      actions.setLoading(true);
      while (state.loading) {
        const result = await generateText({
          model: openai("gpt-5"),
          system:
            "You are a repository structure scanner. Use shell and apply_patch tools only to list files (ls) and view file contents (cat). Never modify files.",
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
      title: "GPT‑5 Structure Scan",
      initialize: () => {
        actions.say(
          "Ready. Ask me to scan this repo; I will run ls and cat as needed.",
        );
      },
      message: async (userInput) => {
        if (state.loading) {
          actions.addMessage(userInput);
          actions.say("Received — will process in the next loop turn.");
          return;
        }
        actions.addMessage(userInput);
        await runAgentLoop();
      },
      stop: () => actions.setLoading(false),
      terminate: () => {},
    };
  },
);

if (import.meta.url === `file://${process.argv[1]}`) {
  run(workflow, {
    title: "🧪 GPT‑5 Repo Structure Scanner",
    approvalPolicy: "suggest",
    config: {
      safeCommands: ["ls", "cat", "pwd"],
      statusLine: "Use Ctrl+K for commands. Type a request to start scanning.",
    },
  });
}


