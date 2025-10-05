import { run, createAgentWorkflow } from "../dist/lib.js";

export const workflowA = createAgentWorkflow(
  "Events Demo A",
  ({ actions, state }) => {
    return {
      title: "Events Demo A",
      initialize: () => {
        actions.say("A ready.");
      },
      message: async (userInput) => {
        actions.addMessage(userInput);
        actions.setLoading(true);
        await new Promise((r) => setTimeout(r, 300));
        actions.say(`A processed: ${String(userInput.content || "").slice(0, 60)}`);
        actions.setLoading(false);
      },
      stop: () => actions.setLoading(false),
      terminate: () => {},
    };
  },
);

export const workflowB = createAgentWorkflow(
  "Events Demo B",
  ({ actions }) => {
    return {
      title: "Events Demo B",
      initialize: () => {
        actions.say("B ready.");
      },
      message: async (userInput) => {
        actions.addMessage(userInput);
        actions.setLoading(true);
        await new Promise((r) => setTimeout(r, 300));
        actions.say(`B processed: ${String(userInput.content || "").slice(0, 60)}`);
        actions.setLoading(false);
      },
      stop: () => actions.setLoading(false),
      terminate: () => {},
    };
  },
);

function logEvent(tag, text) {
  const stamp = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[${stamp}] [${tag}] ${text}`);
}

async function setActiveStatusLine(manager, text) {
  const active = manager.getActiveWorkflow();
  if (active) {
    await active.setState({ statusLine: text });
  }
}

async function postActiveUiMessage(manager, text) {
  const active = manager.getActiveWorkflow();
  if (active) {
    const current = active.getState();
    const messages = Array.isArray(current.messages) ? current.messages : [];
    await active.setState({ messages: [...messages, { role: "ui", content: text }] });
  }
}

async function main() {
  const manager = run([workflowA, workflowB], {
    title: "🧪 Workflow Events Demo",
    approvalPolicy: "suggest",
    config: {
      statusLine: "Listening for workflow events…",
    },
  });

  manager.on("workflow:create", async ({ workflow }) => {
    const text = `Created: ${workflow.title}`;
    logEvent("create", text);
    await setActiveStatusLine(manager, text);
    await postActiveUiMessage(manager, text);
  });

  manager.on("workflow:close", async ({ workflow }) => {
    const text = `Closed: ${workflow.title}`;
    logEvent("close", text);
    await setActiveStatusLine(manager, text);
    await postActiveUiMessage(manager, text);
  });

  manager.on("workflow:switch", async ({ workflow, previousWorkflow }) => {
    const text = `Switched from ${previousWorkflow?.title || "(none)"} to ${workflow.title}`;
    logEvent("switch", text);
    await setActiveStatusLine(manager, text);
    await postActiveUiMessage(manager, text);
  });

  manager.on("workflow:loading", async ({ workflow }) => {
    const text = `${workflow.title} is loading…`;
    logEvent("loading", text);
    await setActiveStatusLine(manager, text);
    await postActiveUiMessage(manager, text);
  });

  manager.on("workflow:ready", async ({ workflow }) => {
    const text = `${workflow.title} is ready`;
    logEvent("ready", text);
    await setActiveStatusLine(manager, text);
    await postActiveUiMessage(manager, text);
  });

  manager.on("workflow:error", async ({ workflow }) => {
    const text = `Error in ${workflow.title}`;
    logEvent("error", text);
    await setActiveStatusLine(manager, text);
    await postActiveUiMessage(manager, text);
  });

  // Trigger a few events to demonstrate the subscriptions
  const first = await manager.createWorkflow(workflowA, { activate: true });
  await first.message({ role: "user", content: "Hello from demo (A)" });

  const second = await manager.createWorkflow(workflowB);
  await manager.switchToWorkflow(second);
  await second.message({ role: "user", content: "Hello from demo (B)" });

  await new Promise((r) => setTimeout(r, 400));
  await manager.switchToWorkflow(first);
  await new Promise((r) => setTimeout(r, 200));
  await manager.closeWorkflow(second);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Top-level await not available in all Node configs; wrap in main()
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  });
}


