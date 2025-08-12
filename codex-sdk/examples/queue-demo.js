import { run, createAgentWorkflow } from "../dist/lib.js";

const queueDemoWorkflow = createAgentWorkflow(
  ({ setState, addMessage, pushQueue, shiftQueue }) => {
    let processing = false;

    async function processNextInQueue() {
      if (processing) {
        return;
      }

      processing = true;
      setState({ loading: true });

      let nextMessage = shiftQueue();
      while (nextMessage) {
        addMessage({
          role: "assistant",
          content: `Processing: "${nextMessage}"`,
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        addMessage({
          role: "assistant",
          content: `Completed: "${nextMessage}"`,
        });

        nextMessage = shiftQueue();
      }

      processing = false;
      setState({ loading: false });
    }

    return {
      initialize: async () => {
        addMessage({
          role: "ui",
          content:
            "Queue Demo Agent ready! Type messages to see them queued while processing.",
        });
      },

      message: async (input) => {
        const userMessage = input.content;

        addMessage(input);
        pushQueue(userMessage);

        addMessage({
          role: "ui",
          content: `Added "${userMessage}" to queue`,
        });

        processNextInQueue();
      },

      stop: () => {
        processing = false;
        setState({ loading: false });
        addMessage({
          role: "ui",
          content: "Processing stopped. Queue preserved.",
        });
      },

      terminate: () => {
        processing = false;
        setState({ loading: false, messages: [], queue: [] });
      },
    };
  },
);

run(queueDemoWorkflow);
