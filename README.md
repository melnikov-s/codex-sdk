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

### Exiting with visible final logs

Use the safe exit helper to guarantee that final messages remain visible after unmounting Ink:

```ts
import { exitSafely } from "codex-sdk";

await exitSafely(0, ["Thanks for using Codex!", "All done."]);
```

### Prompt defaults are required

`prompts.select/confirm/input` option types require `defaultValue` in both UI and headless. In UI, defaults are used on timeout or auto-resolution. In headless, calls resolve immediately with the default.

## Understanding the API

Codex SDK organizes its functionality into three clear namespaces to keep your code clean and intuitive:

### 🎯 **Core State Management** (Top Level)

- **`state`** - Read-only access to your agent's current state (messages, loading status, etc.)
- **`setState`** - The primary way to update your agent's state

### ⚡ **`actions` - Convenient Shortcuts**

The `actions` namespace provides shortcuts for common setState operations:

```javascript
// Instead of writing this:
setState({ loading: true });
setState({ messages: [...state.messages, newMessage] });

// You can write this:
actions.setLoading(true);
actions.addMessage(newMessage);
```

**All `actions` are just convenient shortcuts for `setState` calls.** The key insight:

- **Use `actions.*` for incremental updates** (add message, update one slot, etc.)
- **Use `setState` for wholesale replacement** (replace all slots, reset entire state, etc.)

```javascript
// Incremental: use actions
actions.setLoading(true); // Just update loading
actions.addMessage(response); // Add to messages array
actions.setSlot("aboveInput", <UI />); // Update one slot

// Wholesale replacement: use setState
setState({
  loading: false,
  queue: [], // Replace entire queue
  slots: { aboveInput: <StatusBar /> }, // Replace ALL slots with just this one
});
```

This simple mental model makes it easy to choose the right method for any situation.

### 📝 **String Convenience for Messages**

The `say` action provides a convenient shortcut for adding UI-only messages. Use `say` for simple status updates and notifications:

```javascript
// Instead of writing this:
actions.addMessage({ role: "ui", content: "Processing complete" });

// You can write this:
actions.say("Processing complete"); // Creates a UI message

// Works with arrays too:
actions.say(["Starting task...", "Task complete!"]);
```

Strings passed to `say` are automatically converted to UI messages with `role: "ui"`. These messages are excluded from the conversation transcript and used only for status display.

#### **Message Role Conventions**

- **`role: "ui"`** - Status updates and notifications added via `actions.say()` (excluded from transcript)
- **`role: "assistant"`** - AI responses that come exclusively from LLM calls via `actions.handleModelResult()`
- **`role: "user"`** - User input messages that come from actual user interaction
- **`role: "system"`** - System messages and structured content added via `actions.addMessage()`

### 🛠 **`tools` - AI Tool Integration**

- **`tools.definitions`** - Pass this to your AI model so it knows what tools are available
- **`tools.execute()`** - Directly execute tool calls (used internally by `actions.handleModelResult`)

### 💬 **`prompts` - User Interactions**

- **`prompts.select()`** - Show the user a list of options to choose from
- **`prompts.confirm()`** - Ask yes/no questions
- **`prompts.input()`** - Get freeform text input from the user

### 🔒 **`approval` - Security Policy Management**

- **`approval.getPolicy()`** - Get the current approval policy for tool execution
- **`approval.setPolicy(policy)`** - Dynamically change the approval policy during workflow execution
- **`approval.canAutoApprove(command)`** - Preview whether a command would be auto-approved under the current policy

This organized structure makes it easy to find what you need and keeps your agent code clean and readable.

## Why Codex SDK? For Workflows, Not Assistants.

Tools like GitHub Copilot, Cursor, and Claude Code are general-purpose coding assistants. They are powerful collaborators for a wide range of tasks.

Codex SDK is different. **It is not a tool for building another general-purpose assistant.** Doing so would mean rebuilding a tremendous amount of complexity from scratch.

Instead, Codex SDK is a framework for creating highly specialized, repeatable **workflows**. Think of it as a way to turn a complex series of prompts and tool interactions into a durable, shareable command-line tool. It's for tasks that are more than a single prompt but less than a full-blown AI assistant.

### When to Use Codex SDK

Use this library when you need to perform **real context engineering** for specific, automated tasks, such as:

- **Automated Maintenance:** Create a workflow that automatically fixes a broken build after a dependency update.
- **Targeted Refactoring:** Build a tool that upgrades a specific API across the entire codebase (e.g., migrating from React Router v5 to v6).
- **Intelligent Scaffolding:** Design a workflow that scaffolds a new feature, complete with boilerplate, tests, and documentation, based on your project's unique conventions.
- **Automated Debugging:** Construct a workflow that accesses a bug tracker, analyzes the codebase for potential causes, and suggests a patch.

These workflows are difficult to execute reliably in a general assistant because they require precise control over the context, tools, and interaction model—things that are often hidden or abstracted away.

With Codex SDK, you have the low-level control to engineer the perfect context, ensuring your workflow runs reliably every time. It allows you to transform expert knowledge and complex processes into a simple, executable agent.

## How It Works

Codex SDK divides the work of building an agent between the library and your code, letting you focus on the agent's unique logic.

**What the SDK Handles:**

- **Terminal UI:** Renders the entire interactive experience, including message history, user input, status indicators, and interactive prompts.
- **State Management:** Orchestrates the application state and ensures the UI always reflects the current status.
- **Tool Execution & Security:** Manages the secure execution of tools, handling user approvals and sandboxing for file modifications and shell commands.

**What You Provide:**

- **The Agent Logic:** You define the core intelligence of your agent. This is where you decide when to call an LLM, what to say, which tools to use, and how to respond to user input.

This relationship is managed through a simple event-driven loop. The SDK listens for user input and lifecycle events (like starting or stopping) and calls the corresponding functions in your agent logic. Your code then uses hooks provided by the SDK to update the UI, add messages to the history, and request that tools be executed.

For example, when a user sends a message:

1.  The SDK captures the input and calls your `message` handler.
2.  Your code receives the input, calls your preferred LLM with the conversation history, and gets a response.
3.  Your code uses an SDK hook to add the AI's response to the UI.
4.  If the AI requested a tool, your code uses another hook to ask the SDK to execute it. The SDK handles the security and approval flow, then returns the result to your logic to continue the loop.

This model gives you full control over the agent's brain while the SDK manages the body.

## Practical Examples

### Simple vs. Complex State Updates

The organized API makes it easy to choose the right tool for the job:

```javascript
import { Text } from "ink";

const workflow = createAgentWorkflow(
  ({ state, setState, actions, tools, prompts, approval }) => {
    return {
      message: async (userInput) => {
        // Simple updates: use actions
        actions.addMessage(userInput);
        actions.setLoading(true);

        // Get AI response
        const result = await generateText({
          model: openai("gpt-4o"),
          messages: state.transcript,
          tools: tools.definitions,
        });

        // High-level orchestration: use actions
        await actions.handleModelResult(result);
        actions.setLoading(false);
      },

      stop: () => {
        // Complex state update: use setState directly
        setState({
          loading: false,
          statusLine: "Paused",
          slots: {
            aboveInput: <Text color="yellow">⏸ Agent paused</Text>,
          },
        });
      },
    };
  },
);
```

### User Interaction Example

```javascript
const result = await prompts.select(
  [
    { label: "Create a new file", value: "create" },
    { label: "Edit existing file", value: "edit" },
    { label: "Delete file", value: "delete" },
  ],
  { defaultValue: "create" },
);

if (result === "delete") {
  const confirmed = await prompts.confirm(
    "Are you sure you want to delete this file?",
  );
  if (confirmed) {
    // proceed with deletion
  }
}
```

## Migration from Previous API

If you're upgrading from an earlier version, here's how the API has changed:

```javascript
// ❌ Old API (flat structure)
const workflow = createAgentWorkflow(
  ({
    state,
    setState,
    addMessage,
    tools,
    handleModelResult,
    onSelect,
    onConfirm,
  }) => {
    // tools was passed directly to AI models
    // everything was at the top level
  },
);

// ✅ New API (organized namespaces)
const workflow = createAgentWorkflow(
  ({ state, setState, actions, tools, prompts }) => {
    // Use actions.* for convenience methods
    // Use tools.definitions for AI models
    // Use prompts.* for user interactions
  },
);
```

**Quick Migration:**

- `addMessage` → `actions.addMessage`
- `handleModelResult` → `actions.handleModelResult`
- `tools` → `tools.definitions` (when passing to AI models)
- `onSelect` → `prompts.select`
- `onConfirm` → `prompts.confirm`
- `onPrompt` → `prompts.input`
- `pushQueue` → `actions.addToQueue`
- `shiftQueue` → `actions.removeFromQueue`

## Task List Management

Codex SDK includes a built-in task list system for managing todos and tracking progress. The task list is completely controlled by your agent and appears above the queue with its own bordered interface.

### TaskItem Structure

```typescript
interface TaskItem {
  completed: boolean;
  label: string;
}
```

### Usage Example

```javascript
const workflow = createAgentWorkflow(({ actions, state }) => {
  return {
    initialize: async () => {
      // Add initial tasks
      actions.addTask([
        "Setup project structure",
        { label: "Write documentation", completed: true },
        "Deploy to production",
      ]);
    },

    message: async (input) => {
      // Toggle task completion based on user input
      if (input.content.includes("finished task 1")) {
        actions.toggleTask(0); // Toggle specific task by index
      }

      if (
        input.content.includes("done") ||
        input.content.includes("finished")
      ) {
        actions.toggleTask(); // Toggle next incomplete task automatically
      }

      // Add new tasks dynamically
      if (input.content.startsWith("add task:")) {
        const newTask = input.content.replace("add task:", "").trim();
        actions.addTask(newTask);
      }

      // Access current task list
      const completedTasks = state.taskList.filter((t) => t.completed).length;
      console.log(`${completedTasks}/${state.taskList.length} tasks completed`);
    },
  };
});
```

The task list appears in the terminal with checkmarks (✓) for completed tasks and bullets (•) for pending ones, providing clear visual feedback to users.

## Examples

For more advanced use cases, check out the examples directory:

- `examples/simple-agent.js`: The minimal agent from the Quickstart, ready to run.
- `examples/codebase-quiz.js`: An agent that quizzes you on your own codebase.
- `examples/text-adventure-game.js`: A mini D&D-style text adventure that shows off advanced display customization and human-in-the-loop interaction.
- `examples/project-setup-assistant.js`: A multi-step agent that helps set up a new project.
- `examples/task-list-demo.js`: Interactive task management agent demonstrating the task list functionality.
- `examples/headless-agent.js`: A headless agent that runs the same logic as the simple agent, but without Ink UI.

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

**Example:**

```javascript
import { Text, Box } from "ink";
import React from "react";

// In your agentLogicFunction
return {
  displayConfig: {
    // Custom header as ReactNode
    header: (
      <Text bold color="#d4af37">
        🤖 My Custom Agent
      </Text>
    ),

    // Format role headers for each message
    formatRoleHeader: (message) => {
      if (message.role === "assistant") {
        return (
          <Text bold color="magentaBright">
            🤖 AI Assistant
          </Text>
        );
      }
      if (message.role === "user") {
        return (
          <Text bold color="blueBright">
            👤 You
          </Text>
        );
      }
      return <Text bold>{message.role}</Text>;
    },

    // Format message content with full React control
    formatMessage: (message) => {
      const content = Array.isArray(message.content)
        ? message.content.find((part) => part.type === "text")?.text || ""
        : message.content;

      if (message.role === "assistant" && content.includes("error")) {
        return <Text color="red">❌ {content}</Text>;
      }

      return (
        <Box borderStyle="round" paddingX={1}>
          <Text>{content}</Text>
        </Box>
      );
    },
  },
  // ... other workflow methods
};
```

#### `DisplayConfig` Object

- **`header`**: A `ReactNode` to display as a custom header for the workflow. Use Ink components like `<Text>` and `<Box>` for styling.
- **`formatRoleHeader`**: A function `(message: UIMessage) => ReactNode` that renders the role/label for each message. Return any React component with full control over styling, colors, and layout.
- **`formatMessage`**: A function `(message: UIMessage) => ReactNode` that renders the message content. Use this for complete customization of message appearance, including conditional styling, borders, colors, and complex layouts.

The ReactNode approach gives you complete control over styling with Ink's `<Text>`, `<Box>`, and other components, allowing for dynamic colors, borders, conditional formatting, and complex layouts that weren't possible with the previous string-based API.

---

### The `agentLogicFunction(hooks)`

This is the function you provide to `createAgentWorkflow`. It's where your agent's intelligence resides. It receives a `hooks` object with the following properties:

#### **Core State Management**

- **`state`**: A read-only object containing the current workflow state:
  - `loading`: `boolean` - Whether the agent is currently processing.
  - `messages`: `Array<UIMessage>` - The complete history of all message types.
  - `inputDisabled`: `boolean` - Whether the user input is currently disabled.
  - `queue`: `Array<string>` - The current queue of pending tasks for display.
  - `transcript`: `Array<UIMessage>` - A clean version of `messages` excluding "ui" messages, perfect for sending to an LLM.
  - `statusLine`: `ReactNode` - Optional status line content displayed above the input.
  - `slots`: `Record<SlotRegion, ReactNode>` - Optional UI slots for custom content placement.
- **`setState(newState)`**: Updates the workflow state. See merge semantics below.

#### **`actions` - Convenience Methods**

All actions are shortcuts for common `setState` operations:

- **`actions.addMessage(message)`**: Append one or more messages to the history.
- **`actions.setLoading(boolean)`**: Set the loading state.
- **`actions.setInputDisabled(boolean)`**: Enable/disable user input.
- **`actions.setStatusLine(content)`**: Set status line content.
- **`actions.setSlot(region, content)`**: Set content for a specific slot region.
- **`actions.clearSlot(region)`**: Clear content from a slot region.
- **`actions.clearAllSlots()`**: Clear all slot content.
- **`actions.addToQueue(items)`**: Add items to the task queue.
- **`actions.removeFromQueue()`**: Remove and return the first queue item.
- **`actions.clearQueue()`**: Clear the entire task queue.
- **`actions.addTask(task)`**: Add task(s) to the task list. Accepts a string, TaskItem object, or arrays of either.
- **`actions.toggleTask(index?)`**: Toggle the completion status of a task by index, or the next incomplete task if no index provided.
- **`actions.clearTaskList()`**: Clear the entire task list.
- **`actions.setApprovalPolicy(policy)`**: Set the approval policy for tool execution dynamically.
- **`actions.handleModelResult(result)`**: A powerful convenience function that takes the raw result from an AI model call and orchestrates the next steps: it adds the AI's response messages to the history, securely executes any requested tool calls, and then adds the tool results back to the history, returning the tool responses.

#### **`tools` - Tool System**

- **`tools.definitions`**: Tool definitions that the library supports. Pass these to your AI model so it knows what tools it can call.
- **`tools.execute(messages)`**: The underlying function to execute tool calls requested by the AI. `actions.handleModelResult` uses this internally.

#### **`prompts` - User Interactions**

- **`prompts.select(items, options?)`**: Prompts the user to choose from a list of options. Returns a promise with the selected value.
- **`prompts.confirm(message, options?)`**: Prompts the user with a yes/no question. Returns a promise with the boolean result.
- **`prompts.input(message, options?)`**: Prompts the user for freeform text input. Returns a promise with the string result.

#### **`approval` - Security Policy Management**

- **`approval.getPolicy()`**: Get the current approval policy for tool execution. Returns one of: "suggest", "auto-edit", or "full-auto".
- **`approval.setPolicy(policy)`**: Dynamically change the approval policy during workflow execution. Also accessible via `actions.setApprovalPolicy(policy)`.
- **`approval.canAutoApprove(command, workdir?, writableRoots?)`**: Preview whether a command would be auto-approved under the current policy. Returns a Promise<SafetyAssessment> indicating if the command is safe, requires approval, or would be rejected.

---

### The `AgentObject` (returned by your `agentLogicFunction`)

This is the object your `agentLogicFunction` must return. It defines the lifecycle methods for your agent.

- **`initialize()`**: Called once when the agent starts. Use for setup or sending a welcome message.
- **`message(userInputMessage)`**: Called whenever the user submits input. This is the main entry point for your agent's processing loop.
- **`stop()`**: Called when the user interrupts the agent (e.g., `Esc`). Your agent should halt processing.
- **`terminate()`**: Called when the user quits (e.g., `Ctrl+C`). Your agent should stop and clear its state.
- **`commands`**: An object defining custom slash commands (e.g., `/compact`) that can be triggered by the user from the input line.
- **`displayConfig`**: The display configuration object described above.

---

### `WorkflowState` Structure

The `state` object managed by your workflow has the following structure:

```typescript
type SlotRegion =
  | "aboveHeader"
  | "belowHeader"
  | "aboveHistory"
  | "belowHistory"
  | "aboveTaskList"
  | "belowTaskList"
  | "aboveQueue"
  | "belowQueue"
  | "aboveInput"
  | "belowInput";

interface WorkflowState {
  loading: boolean;
  messages: Array<UIMessage>;
  inputDisabled: boolean;
  queue?: Array<string>; // Optional queue of pending messages
  taskList?: Array<TaskItem>; // Optional task list for todo management
  transcript?: Array<UIMessage>; // Derived: messages filtered to exclude UI messages
  statusLine?: ReactNode; // Optional status line displayed above the input
  slots?: Partial<Record<SlotRegion, ReactNode | null>>; // Optional slot UI regions
  approvalPolicy?: ApprovalPolicy; // Current approval policy for tool execution
}
```

The `state.transcript` property provides a clean message history (excluding "ui" messages) that is perfect for sending to an LLM.

The `state.taskList` property contains an array of TaskItem objects representing the current todo list. Each task has a `completed` boolean and a `label` string.

The `state.statusLine` property allows you to display custom status information above the terminal input. You can set it to any React component or simple text using `setState({statusLine: "Processing..."})` or `setState({statusLine: <Text color="green">✓ Ready</Text>})`.

The `state.approvalPolicy` property contains the current approval policy for tool execution, which can be "suggest", "auto-edit", or "full-auto". This policy determines how shell commands and file modifications are approved by the user.

---

### State update semantics (merge behavior)

`setState` uses simple, predictable behavior:

- **Top-level shallow merge**: Preserves other state properties
- **Everything else replaced**: Arrays, objects, primitives - all get completely replaced with what you provide
- **Functional updater**: Full control to replace or merge anything

This simple behavior makes `setState` predictable and intuitive:

```ts
// Top-level merge: keeps loading, messages, etc.
setState({ inputDisabled: true });

// Complete replacement: replaces ALL slots with just this one
setState({ slots: { aboveInput: <Text>Deploying…</Text> } });

// To update just one slot, use the convenience method instead
actions.setSlot('aboveInput', <Text>Deploying…</Text>);

// Functional form gives you full control
setState(prev => ({
  ...prev,
  slots: { ...prev.slots, aboveInput: null }
}));
```

**The key insight**: Use `actions.*` methods for incremental updates, use `setState` for wholesale replacement.

### Slots API

Slots let you render arbitrary React/Ink UI in known regions around the layout:

- `aboveHeader`, `belowHeader`
- `aboveHistory`, `belowHistory`
- `aboveTaskList`, `belowTaskList`
- `aboveQueue`, `belowQueue`
- `aboveInput`, `belowInput`

Rendering order is top → bottom: `aboveHeader`, header, `belowHeader`, `aboveHistory`, history, `belowHistory`, `aboveTaskList`, taskList, `belowTaskList`, `aboveQueue`, queue, `belowQueue`, `aboveInput`, input, `belowInput`.

Example:

```ts
setState({
  slots: {
    aboveInput: (
      <Box borderStyle="round" paddingX={1}>
        <Text color="yellow">Deploy in progress…</Text>
      </Box>
    )
  }
});
```

## License

This repository is licensed under the [Apache-2.0 License](LICENSE).
