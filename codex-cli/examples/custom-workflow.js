import { run, createAgentWorkflow } from "../dist/lib.js";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const workflow = createAgentWorkflow(
  ({ onMessage, setLoading, handleToolCall, tools, onUIMessage }) => {
    const transcript = [];
    let state = "idle";

    async function startAgentLoop() {
      setLoading(true);
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
            onMessage(aiMessage);

            toolCallResponseForThisTurn = await handleToolCall(aiMessage);

            if (toolCallResponseForThisTurn) {
              transcript.push(toolCallResponseForThisTurn);
              onMessage(toolCallResponseForThisTurn);
              // currentTurn++; // Removed per user request
            } else if (response.finishReason === "stop") {
              state = "paused";
            }
          } else {
            state = "paused";
          }
        } catch (error) {
          onUIMessage("Error during agent processing turn.");
          if (error && typeof error.message === "string") {
            onUIMessage(error.message);
          } else {
            onUIMessage("An unknown error occurred.");
          }
          state = "paused";
        }
      }

      setLoading(false);
    }

    return {
      stop: () => {
        state = "paused";
      },
      terminate: () => {
        onUIMessage("Terminating agent. State reset.");
        state = "idle";
      },
      initialize: async () => {
        onUIMessage(
          "What can I help you with? Provide as much information as possible. Use @ to attach files and images",
        );
      },
      message: async (item) => {
        if (state === "idle") {
          const agentTaskPrompt = `You are a helpful assistant that can help with any task.`;
          transcript.push({ role: "system", content: agentTaskPrompt }, item);

          startAgentLoop();
          return;
        }

        if (state === "paused") {
          transcript.push(item);
          await startAgentLoop();
        } else {
          onUIMessage(
            "Agent is already running. New input will be added to transcript.",
          );
          transcript.push(item);
        }
      },
    };
  },
);

run(workflow);
