import { run, createAgentWorkflow } from "../dist/lib.js";

const queueDemoWorkflow = createAgentWorkflow(({ setState, actions }) => {
  let processing = false;

  async function processNextInQueue() {
    if (processing) {
      return;
    }

    processing = true;
    actions.setLoading(true);

    let nextMessage = actions.removeFromQueue();
    while (nextMessage) {
      // Showcase mixed array: strings become UI messages
      actions.addMessage([
        `Processing: "${nextMessage}"`,
        "Working on it...",
      ]);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      actions.addMessage(`✅ Completed: "${nextMessage}"`);

      nextMessage = actions.removeFromQueue();
    }

    processing = false;
    actions.setLoading(false);
  }

  return {
    initialize: async () => {
      actions.addMessage(
        "Queue Demo Agent ready! Type messages to see them queued while processing.",
      );
    },

    message: async (input) => {
      const userMessage = input.content;

      actions.addMessage(input);
      actions.addToQueue(userMessage);

      actions.addMessage(`Added "${userMessage}" to queue`);

      processNextInQueue();
    },

    stop: () => {
      processing = false;
      actions.setLoading(false);
      actions.addMessage("Processing stopped. Queue preserved.");
    },

    terminate: () => {
      processing = false;
      setState({ loading: false, messages: [], queue: [] });
    },
  };
});

run(queueDemoWorkflow);
