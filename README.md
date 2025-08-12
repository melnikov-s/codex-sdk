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
  return {
    // Set an initial "Ready" message
    initialize: async () => {
      setState({ messages: [{ role: "ui", content: "Ready." }] });
    },
    // This is the core loop, called on every user input
    message: async (userInput) => {
      actions.addMessage(userInput);
      actions.setLoading(true);

      const result = await generateText({
        model: openai("gpt-4o"),
        system: "You are a helpful assistant.",
        messages: state.transcript, // transcript conveniently excludes UI messages
        tools: tools.definitions,
      });

      // handleModelResult adds the AI response, executes tools,
      // and adds tool results to the message history automatically.
      await actions.handleModelResult(result);

      actions.setLoading(false);
    },
    // Cleanup methods for user interruption
    stop: () => actions.setLoading(false),
    terminate: () => setState({ loading: false, messages: [] }),
  };
});

run(workflow);
```

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

### 🛠 **`tools` - AI Tool Integration**

- **`tools.definitions`** - Pass this to your AI model so it knows what tools are available
- **`tools.execute()`** - Directly execute tool calls (used internally by `actions.handleModelResult`)

### 💬 **`prompts` - User Interactions**

- **`prompts.select()`** - Show the user a list of options to choose from
- **`prompts.confirm()`** - Ask yes/no questions
- **`prompts.input()`** - Get freeform text input from the user

This organized structure makes it easy to find what you need and keeps your agent code clean and readable.

## Why Codex SDK vs. Other Agents?

Tools like GitHub Copilot, Cursor, and Claude Code are powerful, integrated assistants. They excel at general-purpose coding tasks but operate within their own fixed systems. You work around their limitations.

**Codex SDK gives you ultimate control.**

This is a framework for developers who need to build specialized agents with precise control over the entire workflow. Because you own the agent loop, you can:

- **Engineer the Perfect Context:** Craft the exact history and system prompts sent to the model. You aren't limited by the context window or prompting strategy of a third-party tool. This precision is key to solving complex, domain-specific problems.
- **Integrate Custom Tools:** Go beyond simple shell commands. Build any tool you can express in code and integrate it seamlessly into your agent's capabilities.
- **Define Unique Workflows:** Implement multi-step chains, custom human-in-the-loop approval gates, or complex logic that commercial assistants don't support.

If you need a highly tailored, powerful, and flexible terminal agent, Codex SDK provides the foundation.

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
  ({ state, setState, actions, tools, prompts }) => {
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

## Examples

For more advanced use cases, check out the examples directory:

- `examples/simple-agent.js`: The minimal agent from the Quickstart, ready to run.
- `examples/codebase-quiz.js`: An agent that quizzes you on your own codebase.
- `examples/text-adventure-game.js`: A mini D&D-style text adventure that shows off advanced display customization and human-in-the-loop interaction.
- `examples/project-setup-assistant.js`: A multi-step agent that helps set up a new project.

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
- **`actions.handleModelResult(result)`**: A powerful convenience function that takes the raw result from an AI model call and orchestrates the next steps: it adds the AI's response messages to the history, securely executes any requested tool calls, and then adds the tool results back to the history, returning the tool responses.

#### **`tools` - Tool System**

- **`tools.definitions`**: Tool definitions that the library supports. Pass these to your AI model so it knows what tools it can call.
- **`tools.execute(messages)`**: The underlying function to execute tool calls requested by the AI. `actions.handleModelResult` uses this internally.

#### **`prompts` - User Interactions**

- **`prompts.select(items, options?)`**: Prompts the user to choose from a list of options. Returns a promise with the selected value.
- **`prompts.confirm(message, options?)`**: Prompts the user with a yes/no question. Returns a promise with the boolean result.
- **`prompts.input(message, options?)`**: Prompts the user for freeform text input. Returns a promise with the string result.

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
  | "aboveInput"
  | "belowInput";

interface WorkflowState {
  loading: boolean;
  messages: Array<UIMessage>;
  inputDisabled: boolean;
  queue?: Array<string>; // Optional queue of pending messages
  transcript?: Array<UIMessage>; // Derived: messages filtered to exclude UI messages
  statusLine?: ReactNode; // Optional status line displayed above the input
  slots?: Partial<Record<SlotRegion, ReactNode | null>>; // Optional slot UI regions
}
```

The `state.transcript` property provides a clean message history (excluding "ui" messages) that is perfect for sending to an LLM.

The `state.statusLine` property allows you to display custom status information above the terminal input. You can set it to any React component or simple text using `setState({statusLine: "Processing..."})` or `setState({statusLine: <Text color="green">✓ Ready</Text>})`.

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
- `aboveInput`, `belowInput`

Rendering order is top → bottom: `aboveHeader`, header, `belowHeader`, `aboveHistory`, history, `belowHistory`, `aboveInput`, input, `belowInput`.

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
