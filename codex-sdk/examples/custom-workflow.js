// Custom workflow example demonstrating the latest Codex SDK features:
// - Queue system: messages queued when agent is busy, processed automatically
// - state.transcript: clean message history (excludes UI messages) for LLM calls
// - state.loading: synchronous state access for immediate logic flow
// - appendMessage(): adds messages to state (auto-appears in state.transcript)
import { run, createAgentWorkflow } from "../dist/lib.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const workflow = createAgentWorkflow(
  ({
    setState,
    state,
    appendMessage,
    handleToolCall,
    tools,
    addToQueue,
    unshiftQueue,
  }) => {
    async function runAgent() {
      setState({ loading: true });

      while (state.loading) {
        try {
          const response = await generateText({
            model: openai("gpt-4o"),
            messages: state.transcript,
            tools,
          });

          const aiMessage = response.response.messages[0];
          if (!aiMessage) {
            break;
          }

          appendMessage(aiMessage);

          const toolResponse = await handleToolCall(aiMessage);
          if (toolResponse) {
            appendMessage(toolResponse);
          } else if (response.finishReason === "stop") {
            break;
          }
        } catch (error) {
          appendMessage({
            role: "ui",
            content: `Error: ${error.message || "Unknown error"}`,
          });
          break;
        }
      }

      // Process any queued messages after finishing current processing
      const nextQueuedMessage = unshiftQueue();
      if (nextQueuedMessage) {
        appendMessage({
          role: "ui",
          content: `Processing queued message: "${nextQueuedMessage}"`,
        });

        appendMessage({
          role: "user",
          content: nextQueuedMessage,
        });

        // Continue processing with the queued message
        return runAgent();
      }

      setState({ loading: false });
    }

    return {
      initialize: async () => {
        setState({
          messages: [
            {
              role: "ui",
              content: "🤖 Agent ready. Type something to start.",
            },
          ],
        });
      },
      message: async (userInput) => {
        if (state.loading) {
          // Agent is busy - add to queue for later processing
          addToQueue(userInput.content);
        } else {
          // Agent is available - process immediately
          appendMessage(userInput);
          runAgent();
        }
      },
      stop: () => {
        setState({ loading: false });
        appendMessage({
          role: "ui",
          content: "Agent stopped.",
        });
      },
      terminate: () => {
        setState({
          loading: false,
          messages: [],
        });
      },
    };
  },
);

run(workflow);
