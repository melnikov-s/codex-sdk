<h1 align="center">Codex SDK</h1>
<p align="center"><b>Build powerful, human-in-the-loop terminal AI workflows.</b></p>

---

## What is Codex SDK?

While simple agent loops can run uninterrupted, the most powerful workflows involve collaboration. Codex SDK is designed specifically for building **human-in-the-loop** terminal agents that can ask questions, get feedback, and work alongside the user.

**Codex SDK handles the hard parts of interactive terminal UI, so you can focus on your agent's logic.**

It's a lightweight framework for creating bespoke agents using the Vercel AI SDK v5. It provides a polished terminal UI, secure tool execution, and a minimal workflow API that makes building interactive, collaborative agents simple.

Originally a fork of the OpenAI Codex CLI, this SDK has been refactored into a reusable library for building custom agentic workflows.

### Core Features

- **Human-in-the-Loop Interaction**: Build agents that can pause to ask questions, present options, and request confirmation from the user before proceeding.
- **Secure Tool Execution**: Safely allow the agent to run terminal commands and modify files with a multi-level approval system that keeps the user in control.
- **Advanced Terminal UI**: A polished, Ink-based interface for message history, multi-line input, status indicators, and more.
- **Display Customization**: Tailor the look and feel of your agent with a powerful theming system, custom message rendering, and configurable headers and borders.
- **Task Queue System**: Manage and display a queue of pending tasks to the user, providing transparency while the agent is processing.
- **Flexible Agent Loop**: You own the agent logic. Plug into Vercel AI SDK v5 and any supported model provider (OpenAI, Anthropic, Google, etc.).

### Requirements

- Node >= 22
- Vercel AI SDK v5 (`ai@^5`)
- A model provider package (e.g., `@ai-sdk/openai`)

### Installation

```shell
pnpm add codex-sdk ai@^5
# Add your preferred model provider
pnpm add @ai-sdk/openai@^2
```

## Quickstart: A Simple Agent in 20 Lines

This example creates a helpful assistant that can use tools.

```javascript
// simple-agent.js
import { run, createAgentWorkflow } from "codex-sdk";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const workflow = createAgentWorkflow(({ state, setState, actions, tools }) => {
  async function runAgentLoop() {
    actions.setLoading(true);
    while (state.loading) {
      const result = await generateText({
        model: openai("gpt-4o"),
        system: "You are a helpful assistant.",
        messages: state.transcript, // excludes UI messages
        tools: tools.definitions,
      });

      // Adds AI response, executes tools, appends tool results
      const toolResponses = await actions.handleModelResult(result);

      // Decide if the loop should end
      if (result.finishReason === "stop") {
        actions.setLoading(false);
        break;
      }

      // If the user typed while we were running, handle it next iteration
      // (Optional) You can also flush a custom queue here
    }
  }

  return {
    initialize: () => {
      actions.say("Ready. Starting agent loop…");
      runAgentLoop();
    },

    // When the user types during the loop, decide what to do
    message: async (userInput) => {
      if (state.loading) {
        // Queue the message for the next turn
        actions.addMessage(userInput);
        actions.say("💡 Got your message — I'll consider it next turn.");
        return;
      }

      // If we're idle, accept the message and kick the loop again
      actions.addMessage(userInput);
      runAgentLoop();
    },

    stop: () => actions.setLoading(false),
  };
});

run(workflow);
```

## Headless mode (advanced)

Codex can run the exact same workflow logic without rendering the Ink UI.

- Use `run(workflowFactory, { headless: true })` to execute your workflow in a non-interactive process.
- Headless shares the same `WorkflowHooks` contract (plus `headless: true`) and state semantics.
- Prompts (`prompts.select/confirm/input`) resolve immediately to the provided defaults; defaults are required at the type level in both modes.
- Only native tools are included; `user_select` is omitted in headless.
- Logs are sequential and durable. New messages are printed exactly once in order of appearance and never reprinted on wholesale state replacement.

```ts
import { run, createAgentWorkflow, AutoApprovalMode } from "codex-sdk";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// A headless workflow that summarizes your repository and lists recent git stats
const workflow = createAgentWorkflow(({ state, actions, tools, control }) => {
  return {
    initialize() {
      actions.say("Analyzing repository…");
      control.message({
        role: "user",
        content:
          "Summarize the repo structure. Then run `git status --porcelain` and count changed files. Finally, print a short summary.",
      });
    },
    async message(input) {
      actions.addMessage(input);
      actions.setLoading(true);

      const result = await generateText({
        model: openai("gpt-4o"),
        messages: state.transcript,
        tools: tools.definitions, // contains shell/apply_patch in headless
      });

      await actions.handleModelResult(result);
      actions.setLoading(false);
    },
    stop() {
      actions.setLoading(false);
    },
    terminate() {
      /* no-op */
    },
  };
});

const controller = run(workflow, {
  approvalPolicy: AutoApprovalMode.SUGGEST,
  log: { mode: "human" },
  headless: true,
});

// Optional: inspect state or send messages programmatically
// controller.getState();
```

### Controller API (UI and Headless)

`run()` returns a `WorkflowController` in both modes. In UI mode, it is a stable proxy that delegates once the UI workflow is constructed.

- `message(input: string | ModelMessage)` – Sends a user message; a string is normalized to `{ role: 'user', content: string }`.
- `stop()` – Stops the current processing.
- `terminate(code?: number)` – Terminates the workflow instance (does not exit the process).
- `getState(): WorkflowState` – Returns a read-only snapshot of workflow state.
- `headless: boolean` – `true` in headless.

## Multi‑Workflow Tabs (Launcher‑first)

Register workflow types with static titles and create instances on demand. No tabs are opened automatically; the launcher overlay appears on start.

```ts
import { runMultiWorkflow, createWorkflow } from "codex-sdk";

// Register available workflow TYPES with static titles
const available = [
  createWorkflow("Coding Agent", createCodingWorkflow()),
  createWorkflow("Research Assistant", createResearchWorkflow()),
  createWorkflow("Code Review", createReviewWorkflow()),
];

const controller = runMultiWorkflow(available, { approvalPolicy: "suggest" });

// Programmatic instance creation
const id = controller.createInstance(available[0], { activate: true });
controller.switchToInstance(id);
```

### Visual Tabs and Manager Slots

- Tabs appear above the header with status indicators: `⏳` loading, `⚠️` attention, `🔔` notifications, `❌` error, `▶` active.
- Manager‑level slots let you render UI around the entire multi‑workflow layout and persist across tab switches:

```ts
controller.slots.set("aboveTabs", <Text>My Banner</Text>);
controller.slots.set("belowWorkflow", <Text dimColor>Ctrl+` opens the launcher</Text>);
```

Available manager slot regions: `aboveTabs`, `aboveWorkflow`, `belowWorkflow`.

### Keyboard Shortcuts

- Ctrl+1…Ctrl+9: switch to workflows 1–9
- Ctrl+Alt+1…Ctrl+Alt+9: switch to workflows 10–18
- Ctrl+Tab / Ctrl+Shift+Tab: next/previous workflow
- Ctrl+`: open launcher (or Ctrl+O)
- Ctrl+N / Ctrl+P, Alt+→ / Alt+←: reliable fallbacks on macOS

### Slash Commands

- `/switch` or `/switch <name|id>`: open the picker or switch by id/name
- `/tabs`: show tabs overview
- `/launcher`: open the launcher to create a new instance
- `/close`: close current instance (graceful)
- `/kill`: force‑kill current instance

### Controller API (Multi‑Workflow)

```ts
interface MultiWorkflowController extends WorkflowController {
  // Instances
  createInstance(
    factory: WorkflowFactoryWithTitle,
    opts?: { activate?: boolean; title?: string },
  ): string;
  removeInstance(
    id: string,
    opts?: { graceful?: boolean; force?: boolean },
  ): void;
  switchToInstance(id: string): void;
  listInstances(): Array<{
    id: string;
    title: string;
    status: string;
    attention: AttentionState;
    isActive: boolean;
  }>;
  getActiveInstance(): string | null;

  // Attention/navigation
  getWorkflowsRequiringAttention(): string[];
  switchToNextAttention(): boolean;
  switchToNextNonLoading(): boolean;
  switchToPreviousNonLoading(): boolean;
  updateWorkflowAttention(id: string, updates: Partial<AttentionState>): void;
  updateWorkflowStatus(
    id: string,
    status: "loading" | "idle" | "waiting" | "error",
  ): void;

  // Manager slots (persist across tab switches)
  slots: {
    set(
      region: "aboveTabs" | "aboveWorkflow" | "belowWorkflow",
      content: ReactNode | ((state: WorkflowState) => ReactNode) | null,
    ): void;
    clear(region: "aboveTabs" | "aboveWorkflow" | "belowWorkflow"): void;
    clearAll(): void;
  };

  // Launcher
  listAvailableWorkflows(): Array<{
    title: string;
    factory: WorkflowFactoryWithTitle;
  }>;
  openLauncher(): void;
}
```

## Security & Approvals

The SDK is designed for safety. When the agent wants to run a shell command or modify files using `handleToolCall`, its capabilities are restricted by an `approvalPolicy`.

| Mode          | What the agent may do without asking                        | Still requires approval (managed by the library)                   |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| **Suggest**   | <li>Read any file in the repo                               | <li>**All** file writes/patches<li>**Any** arbitrary shell command |
| **Auto Edit** | <li>Read **and** apply patches to files                     | <li>**All** shell commands                                         |
| **Full Auto** | <li>Read/write files <li>Execute shell commands (sandboxed) | -                                                                  |

By default, even in **Full Auto**, commands are run **network-disabled** and confined to the current working directory for defense-in-depth using platform-specific sandboxing (Apple Seatbelt on macOS).

## API Reference

This section provides detailed documentation for the core APIs, display customization, and state management.

---

### `run(workflowFactory, options?)`

Starts the terminal UI using your workflow factory.

- **`workflowFactory`**: The object returned by `createAgentWorkflow`.
- **`options.approvalPolicy`** (optional): Controls tool approvals (`AutoApprovalMode.SUGGEST`, `AutoApprovalMode.AUTO_EDIT`, `AutoApprovalMode.FULL_AUTO`).

---

### `createAgentWorkflow(agentLogicFunction)`

Wraps your function into a `WorkflowFactory` the UI can execute. This is the primary helper for building your custom agent. Your function receives a `hooks` object and must return an `AgentObject`.

---

### Display Customization

You can provide a `displayConfig` object from your `agentLogicFunction`'s return value to customize the look and feel of your agent with full React component control.
