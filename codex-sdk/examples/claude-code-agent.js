import { query } from "@anthropic-ai/claude-code";
import { execSync } from "child_process";
import { run, createAgentWorkflow, getTextContent } from "codex-sdk";

function getClaudePath() {
  try {
    return execSync("which claude", { encoding: "utf8" }).trim();
  } catch (error) {
    throw new Error(
      "Claude executable not found. Make sure Claude Code is installed and in your PATH.",
    );
  }
}

export const workflow = createAgentWorkflow(
  "Claude Code Agent",
  ({ state, actions }) => {
    async function runClaudeCode() {
      actions.setLoading(true);

      const userMessages = state.messages.filter((m) => m.role === "user");
      const lastMessage = userMessages[userMessages.length - 1];
      const prompt = getTextContent(lastMessage) || "";

      try {
        for await (const message of query({
          prompt,
          options: {
            pathToClaudeCodeExecutable: getClaudePath(),
            continue: true,
          },
        })) {
          if (message.type === "assistant") {
            const content = message.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "text") {
                  actions.addMessage({
                    role: "assistant",
                    content: block.text,
                  });
                }
              }
            }
          }

          if (message.type === "result") {
            actions.setLoading(false);
            break;
          }
        }
      } catch (error) {
        actions.say(`Error: ${error.message}`);
        actions.setLoading(false);
      }
    }

    return {
      initialize: async () => {
        actions.say("Claude Code Agent ready!");
      },

      message: async (userInput) => {
        actions.addMessage(userInput);
        await runClaudeCode();
      },

      stop: () => actions.setLoading(false),
    };
  },
);

// eslint-disable-next-line no-undef
if (import.meta.url === `file://${process.argv[1]}`) {
  run(workflow);
}
