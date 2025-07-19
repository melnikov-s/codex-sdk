import { run, createAgentWorkflow } from "../dist/lib.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const workflow = createAgentWorkflow(
  ({
    setState,
    _getState,
    appendMessage,
    handleToolCall,
    tools,
    _onConfirm,
    _onPromptUser,
    _onSelect,
  }) => {
    const transcript = [];
    let state = "idle";

    async function startAgentLoop() {
      setState({ loading: true });
      state = "running";

      while (state === "running") {
        let toolCallResponseForThisTurn = null;

        try {
          const response = await generateText({
            model: openai("gpt-4o"),
            messages: transcript,
            tools,
          });

          const aiMessage = response.response.messages[0];

          if (aiMessage) {
            transcript.push(aiMessage);
            appendMessage(aiMessage);

            toolCallResponseForThisTurn = await handleToolCall(aiMessage);

            if (toolCallResponseForThisTurn) {
              transcript.push(toolCallResponseForThisTurn);
              appendMessage(toolCallResponseForThisTurn);
            } else if (response.finishReason === "stop") {
              state = "paused";
            }
          } else {
            state = "paused";
          }
        } catch (error) {
          appendMessage({
            role: "ui",
            content: "Error during agent processing turn.",
          });
          if (error && typeof error.message === "string") {
            appendMessage({
              role: "ui",
              content: error.message,
            });
          } else {
            appendMessage({
              role: "ui",
              content: "An unknown error occurred.",
            });
          }
          state = "paused";
        }
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
        transcript.push(userInput);
        if (state === "idle" || state === "paused") {
          startAgentLoop();
        } else {
          // Agent is already running, input is added to transcript for next turn
          appendMessage({
            role: "ui",
            content: "Input added to ongoing conversation.",
          });
        }
      },
      stop: () => {
        state = "paused";
        setState({ loading: false });
        appendMessage({
          role: "ui",
          content: "Agent paused.",
        });
      },
      terminate: () => {
        state = "idle";
        transcript.length = 0; // Clear transcript
        setState({
          loading: false,
          messages: [],
        });
      },
    };
  },
);

run(workflow);
