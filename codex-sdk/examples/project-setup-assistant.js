// Project Setup Assistant - showcasing user_select for guided workflows:
// - Suggested choices with "None of the above" for custom input
// - Decision trees based on user preferences
// - Timeout for when users step away during setup
// - Progressive questioning based on previous answers
import { run, createAgentWorkflow } from "../dist/lib.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const workflow = createAgentWorkflow(({ setState, state, actions, tools }) => {
  let projectConfig = {};
  let setupActive = false;

  async function runAssistant() {
    setState({ loading: true });

    while (state.loading) {
      try {
        const systemPrompt = `You are a Project Setup Assistant helping a developer create a new project.

CURRENT CONFIG: ${JSON.stringify(projectConfig, null, 2)}
SETUP STATUS: ${setupActive ? "ACTIVE" : "WAITING TO START"}

Your job is to:
1. Ask about project type, framework, features they want
2. Offer popular suggestions but always include "None of the above" for custom options
3. Build up a complete project configuration step by step
4. When done, summarize their choices and offer to generate starter files

IMPORTANT: Use user_select tool for ALL questions. Examples:
- Project type: ["Web App", "Mobile App", "API/Backend"]
- Framework: ["React", "Vue", "Next.js"]
- Features: ["Authentication", "Database", "Testing"]

Always include timeout (45s) and defaultValue. Be conversational and helpful!`;

        const result = await generateText({
          model: openai("gpt-4o"),
          system: systemPrompt,
          messages: state.transcript,
          tools: tools.definitions,
        });

        await actions.handleModelResult(result);

        if (result.finishReason === "stop") {
          // User selected "None of the above" - they'll provide custom input
          actions.addMessage({
            role: "ui",
            content: "💬 Please tell me more about what you have in mind...",
          });
          actions.setLoading(false);
          break;
        }
      } catch (error) {
        actions.addMessage({
          role: "ui",
          content: `❌ Error: ${error.message || "Unknown error"}`,
        });
        break;
      }
    }
  }

  return {
    initialize: async () => {
      setState({
        messages: [
          {
            role: "ui",
            content:
              "🚀 Welcome to Project Setup Assistant! 📋\n\n" +
              "I'll help you configure a new project by asking about your preferences.\n" +
              "Don't see an option that fits? Just select 'None of the above' and tell me what you need!\n\n" +
              "Ready to start? Type 'setup' to begin! ⚙️",
          },
        ],
      });
    },
    message: async (userInput) => {
      const content = userInput.content.toLowerCase().trim();

      if (!setupActive && (content === "setup" || content.includes("setup"))) {
        setupActive = true;
        projectConfig = {};
        actions.addMessage([
          userInput,
          {
            role: "ui",
            content:
              "⚙️ Setup Started! I'll ask you a few questions to understand your project needs.\n" +
              "Remember: You can always choose 'None of the above' to provide custom details! 💡",
          },
        ]);
        runAssistant();
      } else if (!setupActive) {
        actions.addMessage([
          userInput,
          {
            role: "ui",
            content:
              "🚀 Type 'setup' when you're ready to configure your project!",
          },
        ]);
      } else {
        // Setup is active, user provided custom input after "None of the above"
        actions.addMessage([
          userInput,
          {
            role: "ui",
            content:
              "👍 Got it! I'll take that into account for your project setup...",
          },
        ]);
        runAssistant();
      }
    },
    stop: () => {
      setState({ loading: false });
      actions.addMessage({
        role: "ui",
        content:
          "⏸️ Setup paused. Type anything to continue configuring your project!",
      });
    },
    terminate: () => {
      setupActive = false;
      projectConfig = {};
      setState({
        loading: false,
        messages: [],
      });
    },
  };
});

// Export the workflow for use in multi-workflow demos
export const projectSetupWorkflow = workflow;

// Run standalone if this file is executed directly
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  run(workflow);
}
