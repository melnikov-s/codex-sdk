import { run, createAgentWorkflow } from "../dist/lib.js";

const queueDemoWorkflow = createAgentWorkflow(
  ({ setState, appendMessage, addToQueue, unshiftQueue }) => {
    let processing = false;

    async function processNextInQueue() {
      if (processing) {
        return;
      }

      processing = true;
      setState({ loading: true });

      let nextMessage = unshiftQueue();
      while (nextMessage) {
        appendMessage({
          role: "assistant",
          content: `Processing: "${nextMessage}"`,
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        appendMessage({
          role: "assistant",
          content: `Completed: "${nextMessage}"`,
        });

        nextMessage = unshiftQueue();
      }

      processing = false;
      setState({ loading: false });
    }

    return {
      initialize: async () => {
        appendMessage({
          role: "ui",
          content:
            "Queue Demo Agent ready! Type messages to see them queued while processing.",
        });
      },

      message: async (input) => {
        const userMessage = input.content;

        appendMessage(input);
        addToQueue(userMessage);

        appendMessage({
          role: "ui",
          content: `Added "${userMessage}" to queue`,
        });

        processNextInQueue();
      },

      stop: () => {
        processing = false;
        setState({ loading: false });
        appendMessage({
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
